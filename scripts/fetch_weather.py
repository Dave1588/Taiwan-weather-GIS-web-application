#!/usr/bin/env python3
"""
Taiwan Weather GIS - CWA ETL Data Pipeline
Fetches 36-hour weather forecasts for Taiwan counties and cities from CWA OpenData API (F-C0032-001)
and exports enriched GIS JSON to public/data/weather.json.
"""

import os
import sys
import json
import datetime
from pathlib import Path

# Taiwan 22 Administrative Divisions Coordinates (Center Points)
CITY_COORDINATES = {
    "臺北市": {"lat": 25.0330, "lon": 121.5654},
    "新北市": {"lat": 25.0118, "lon": 121.4658},
    "基隆市": {"lat": 25.1276, "lon": 121.7392},
    "桃園市": {"lat": 24.9936, "lon": 121.3010},
    "新竹市": {"lat": 24.8138, "lon": 120.9675},
    "新竹縣": {"lat": 24.8387, "lon": 121.0177},
    "苗栗縣": {"lat": 24.5602, "lon": 120.8214},
    "臺中市": {"lat": 24.1477, "lon": 120.6736},
    "彰化縣": {"lat": 24.0518, "lon": 120.5161},
    "南投縣": {"lat": 23.9609, "lon": 120.9719},
    "雲林縣": {"lat": 23.7092, "lon": 120.4313},
    "嘉義市": {"lat": 23.4800, "lon": 120.4491},
    "嘉義縣": {"lat": 23.4518, "lon": 120.2555},
    "臺南市": {"lat": 22.9997, "lon": 120.2270},
    "高雄市": {"lat": 22.6273, "lon": 120.3014},
    "屏東縣": {"lat": 22.5519, "lon": 120.5487},
    "宜蘭縣": {"lat": 24.7021, "lon": 121.7377},
    "花蓮縣": {"lat": 23.9872, "lon": 121.6016},
    "臺東縣": {"lat": 22.7583, "lon": 121.1444},
    "澎湖縣": {"lat": 23.5712, "lon": 119.5793},
    "金門縣": {"lat": 24.4493, "lon": 118.3766},
    "連江縣": {"lat": 26.1602, "lon": 119.9519},
}

def load_env():
    """Load environment variables from .env file if present."""
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val

def normalize_city_name(name: str) -> str:
    """Normalize '台' to '臺' for coordinate lookups."""
    return name.replace("台", "臺")

def fetch_cwa_raw_data(api_key: str) -> dict:
    """Fetch raw JSON from CWA API with requests or urllib fallback."""
    url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization={api_key}&format=JSON"
    
    # Try requests first
    try:
        import requests
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except (ImportError, Exception):
        # Fallback to standard library urllib
        import urllib.request
        import ssl
        
        req = urllib.request.Request(url, headers={"User-Agent": "Taiwan-Weather-GIS/1.0"})
        # Attempt with default SSL context, then unverified context if certificate verification fails
        try:
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception:
            ctx = ssl._create_unverified_context()
            with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
                return json.loads(response.read().decode("utf-8"))

def parse_weather_data(raw_data: dict) -> list:
    """Parse CWA F-C0032-001 records into standard location items."""
    locations = []
    records = raw_data.get("records", {}).get("location", [])

    for loc in records:
        city_raw = loc.get("locationName", "")
        city_norm = normalize_city_name(city_raw)
        coords = CITY_COORDINATES.get(city_norm, {"lat": 23.5, "lon": 121.0})
        
        # Weather elements mapping
        elements = {}
        for elem in loc.get("weatherElement", []):
            elem_name = elem.get("elementName")
            times = elem.get("time", [])
            if times:
                param = times[0].get("parameter", {})
                param_name = param.get("parameterName", "")
                elements[elem_name] = param_name

        weather_desc = elements.get("Wx", "晴時多雲")
        try:
            min_t = int(elements.get("MinT", 20))
        except (ValueError, TypeError):
            min_t = 20

        try:
            max_t = int(elements.get("MaxT", 28))
        except (ValueError, TypeError):
            max_t = 28

        pop_val = elements.get("PoP", "0")
        pop_str = f"{pop_val}%" if not str(pop_val).endswith("%") else str(pop_val)
        comfort = elements.get("CI", "舒適")

        locations.append({
            "city": city_raw,
            "lat": coords["lat"],
            "lon": coords["lon"],
            "weather": weather_desc,
            "minT": min_t,
            "maxT": max_t,
            "pop": pop_str,
            "ci": comfort
        })

    return locations

def generate_fallback_data() -> list:
    """Provide realistic fallback data if API key is missing or network fails."""
    sample_conditions = [
        ("臺北市", "多雲短暫雨", 22, 28, "40%", "舒適至悶熱"),
        ("新北市", "多雲短暫雨", 21, 27, "40%", "舒適"),
        ("基隆市", "陰短暫雨", 20, 25, "60%", "舒適至稍有涼意"),
        ("桃園市", "多雲時晴", 21, 28, "20%", "舒適"),
        ("新竹市", "晴時多雲", 22, 29, "10%", "舒適"),
        ("新竹縣", "晴時多雲", 21, 29, "10%", "舒適"),
        ("苗栗縣", "晴時多雲", 21, 29, "10%", "舒適"),
        ("臺中市", "晴天", 23, 31, "0%", "悶熱"),
        ("彰化縣", "晴時多雲", 23, 30, "10%", "悶熱"),
        ("南投縣", "多雲午後短暫雷陣雨", 20, 29, "30%", "舒適至悶熱"),
        ("雲林縣", "晴天", 23, 31, "10%", "悶熱"),
        ("嘉義市", "晴天", 22, 31, "10%", "悶熱"),
        ("嘉義縣", "晴天", 22, 31, "10%", "悶熱"),
        ("臺南市", "晴時多雲", 24, 32, "10%", "悶熱"),
        ("高雄市", "多雲時晴", 25, 32, "20%", "悶熱"),
        ("屏東縣", "多雲時晴", 24, 33, "20%", "悶熱"),
        ("宜蘭縣", "陰短暫雨", 21, 26, "50%", "舒適"),
        ("花蓮縣", "多雲短暫雨", 22, 28, "30%", "舒適"),
        ("臺東縣", "多雲", 23, 29, "20%", "舒適"),
        ("澎湖縣", "晴時多雲", 24, 29, "10%", "舒適"),
        ("金門縣", "晴時多雲", 21, 27, "10%", "舒適"),
        ("連江縣", "陰天", 18, 23, "20%", "涼爽"),
    ]
    locations = []
    for city, wx, min_t, max_t, pop, ci in sample_conditions:
        norm = normalize_city_name(city)
        coords = CITY_COORDINATES.get(norm, {"lat": 23.5, "lon": 121.0})
        locations.append({
            "city": city,
            "lat": coords["lat"],
            "lon": coords["lon"],
            "weather": wx,
            "minT": min_t,
            "maxT": max_t,
            "pop": pop,
            "ci": ci
        })
    return locations

def main():
    load_env()
    api_key = os.environ.get("CWA_API_KEY", "").strip()

    project_root = Path(__file__).resolve().parent.parent
    output_dir = project_root / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "weather.json"

    locations = []
    source = "fallback"

    if api_key:
        print(f"[*] Fetching live data from CWA API (Key: {api_key[:6]}***)...")
        try:
            raw_data = fetch_cwa_raw_data(api_key)
            if raw_data.get("success") == "true" or "records" in raw_data:
                locations = parse_weather_data(raw_data)
                source = "CWA OpenData Live API"
                print(f"[+] Successfully fetched {len(locations)} locations from CWA.")
            else:
                print(f"[!] Warning: CWA API returned non-success: {raw_data.get('message', 'Unknown error')}")
        except Exception as e:
            print(f"[!] Error fetching from CWA API: {e}")
    else:
        print("[!] Warning: CWA_API_KEY environment variable not found.")

    if not locations:
        print("[*] Generating fallback dataset for Taiwan 22 administrative divisions...")
        locations = generate_fallback_data()
        source = "Offline Fallback Dataset"

    payload = {
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": source,
        "count": len(locations),
        "locations": locations
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"[OK] Weather payload successfully written to {output_file}")
    print(f"     - Updated at: {payload['updated_at']}")
    print(f"     - Total locations: {len(locations)}")

if __name__ == "__main__":
    main()
