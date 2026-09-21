# Project Design Document: Taiwan Weather GIS Web (Vercel Edition)

## 1. Objective & Target Architecture
Develop and deploy a serverless, static Taiwan Weather GIS Web Dashboard using open data from the Central Weather Administration (CWA).

- Data Ingestion: Python pipeline consuming CWA OpenData API (F-C0032-001).
- Data Persistence: Static JSON cache (`public/data/weather.json`) updated on a schedule via GitHub Actions to maintain compatibility with Vercel's stateless CDN edge hosting.
- Frontend / GIS Layer: Responsive, lightweight static Web App (`index.html`, `style.css`, `app.js`) powered by Leaflet.js and OpenStreetMap tiles.
- CI/CD & Hosting: GitHub Actions for scheduled data refresh and automated continuous deployment to Vercel.

---

## 2. Directory Layout
```
taiwan-weather-gis/
├── .github/
│   └── workflows/
│       └── update-weather.yml     # Cron workflow to fetch CWA data and push commit
├── scripts/
│   └── fetch_weather.py           # Python ETL script
├── public/
│   ├── css/
│   │   └── style.css              # Custom styling & map containers
│   ├── js/
│   │   └── app.js                 # Leaflet GIS logic & dynamic UI cards
│   ├── data/
│   │   └── weather.json           # Cached CWA weather payload
│   └── index.html                 # Main dashboard UI entrypoint
├── vercel.json                    # Routing and root configuration for Vercel
├── requirements.txt               # Dependencies for data ingestion
├── .gitignore
└── README.md
```

---

## 3. Step-by-Step Implementation Instructions

### Step 1: Environment & Dependencies
Create `requirements.txt`:
```txt
requests>=2.31.0
```

Create `.gitignore`:
```gitignore
__pycache__/
*.pyc
.env
.DS_Store
```

---

### Step 2: CWA ETL Data Pipeline (`scripts/fetch_weather.py`)
- Read API key from environment variable: `CWA_API_KEY`.
- Target endpoint: `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?format=JSON`.
- Filter and parse:
  - Location Name (`locationName`)
  - Min Temperature (`MinT`)
  - Max Temperature (`MaxT`)
  - Weather Phenomenon (`Wx`)
  - Probability of Precipitation (`PoP`)
- Enrich records with geographic coordinates (Latitude, Longitude) for each Taiwan county center.
- Export atomic JSON structure to `public/data/weather.json` formatted as:
```json
{
  "updated_at": "2026-09-21T12:00:00Z",
  "locations": [
    {
      "city": "臺北市",
      "lat": 25.0330,
      "lon": 121.5654,
      "weather": "多雲短暫雨",
      "minT": 24,
      "maxT": 30,
      "pop": "30%"
    }
  ]
}
```

---

### Step 3: Frontend GIS & Visualization

#### 3.1 `public/index.html`
- Include Leaflet.js CDN (`leaflet.css` and `leaflet.js`).
- Layout structure:
  - Header: Dashboard Title & "Last Updated" timestamp.
  - Sidebar / Drawer: Detailed forecast table & selected county card.
  - Main Panel: Map container (`#map`).

#### 3.2 `public/css/style.css`
- Responsive split layout (sidebar + full-height map viewport).
- Clean pop-up styling with custom badges for temperature grades:
  - Hot ($\ge 30^\circ\text{C}$): Coral / Red
  - Mild ($22^\circ\text{C} - 29^\circ\text{C}$): Amber / Green
  - Cool ($< 22^\circ\text{C}$): Cyan / Blue

#### 3.3 `public/js/app.js`
- Initialize Leaflet map centered at `[23.7, 120.9]` with zoom level `7`.
- Fetch `data/weather.json`.
- For each record:
  - Render an interactive `L.circleMarker` styled dynamically by `maxT`.
  - Bind a popup containing County Name, Weather condition, Temp Range, and Rain Chance.
  - Synchronize marker clicks with the sidebar forecast details.

---

### Step 4: Vercel Configuration (`vercel.json`)
Set static routing to serve the `public` directory cleanly:
```json
{
  "outputDirectory": "public",
  "cleanUrls": true
}
```

---

### Step 5: Automated GitHub Actions Schedule (`.github/workflows/update-weather.yml`)
Configure automatic ingestion to keep `weather.json` current:
```yaml
name: Update Weather Data

on:
  schedule:
    - cron: '0 */3 * * *' # Runs every 3 hours
  workflow_dispatch:        # Allows manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Dependencies
        run: pip install -r requirements.txt

      - name: Fetch CWA Data
        env:
          CWA_API_KEY: ${{ secrets.CWA_API_KEY }}
        run: python scripts/fetch_weather.py

      - name: Commit and Push Changes
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/weather.json
          git commit -m "chore: auto-update weather data [skip ci]" || exit 0
          git push
```

---

## 4. Execution & Delivery Protocol

1. **Scaffold Directory Structure**:
   Create all planned folders and base files.
2. **Implement ETL & Validate**:
   Write `scripts/fetch_weather.py`, run once locally with fallback mock data or valid key, and ensure `public/data/weather.json` is generated correctly.
3. **Build Frontend**:
   Write `index.html`, `style.css`, and `app.js`. Test using a local static HTTP server (`python -m http.server -d public 8000`).
4. **Git Initialization & Remote Push**:
   Execute the following sequence:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Taiwan weather GIS web application"
   git branch -M main
   # Set remote URL provided by user or current workspace
   git remote add origin <TARGET_REPOSITORY_URL>
   git push -u origin main
   ```