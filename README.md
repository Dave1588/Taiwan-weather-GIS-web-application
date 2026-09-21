# 台灣即時氣象 GIS 觀測儀表板 (Taiwan Weather GIS Dashboard)

![Taiwan Weather GIS](https://img.shields.io/badge/CWA-OpenData-blue?style=for-the-badge)
![Leaflet.js](https://img.shields.io/badge/Leaflet-1.9.4-brightgreen?style=for-the-badge&logo=leaflet)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions)

基於交通部中央氣象署（CWA）開放資料 API（`F-C0032-001`）建構之高質感、現代化、輕量級台灣氣象 GIS 互動儀表板。

---

## 🌟 核心特色 (Key Features)

- 🗺️ **GIS 空間視覺化**：
  - 基於 Leaflet.js 互動式向量地圖，標註台灣本島及離島共 22 個縣市。
  - 動態溫度光圈與脈衝標記（烈焰珊瑚紅 ≥30°C、翡翠琥珀綠 22~29°C、冰霜青藍 <22°C）。
  - 支援多款現代底圖切換（暗黑科技 Dark Matter、明亮簡約 Positron、街道標準 OSM）。
- 📊 **雙向聯動側邊欄**：
  - 全台即時統計面板：平均氣溫、最高溫縣市、最低溫縣市、降雨機率預警。
  - 即時模糊搜尋（依縣市名稱或天氣現象關鍵字）與溫度等級快捷篩選（全部、炎熱、舒適、涼爽）。
  - 側邊欄卡片與地圖標記雙向同步：點擊任一縣市自動平滑飛越定位並彈出詳細預報。
- ⚡ **無伺服器與邊緣快取架構**：
  - 純靜態前端架構，相容於 Vercel Serverless Edge CDN。
  - 透過 GitHub Actions 每 3 小時自動觸發 Python ETL 腳本，向 CWA API 獲取最新氣象預報並自動提交至 `public/data/weather.json`。
  - 內建離線備援數據機制，在無 API Key 或網路異常時自動維持 100% 正常運作。

---

## 🏗️ 專案目錄結構 (Directory Layout)

```
Taiwan-weather-GIS-web-application/
├── .github/
│   └── workflows/
│       └── update-weather.yml     # Cron 定時工作流：每 3 小時自動抓取 CWA 並推送
├── scripts/
│   └── fetch_weather.py           # Python ETL 氣象資料擷取與地理資訊編碼腳本
├── public/
│   ├── css/
│   │   └── style.css              # 現代深色科技感樣式（Glassmorphism & 動畫）
│   ├── js/
│   │   └── app.js                 # Leaflet GIS 地圖邏輯與響應式雙向聯動
│   ├── data/
│   │   └── weather.json           # 22 縣市快取氣象數據
│   └── index.html                 # 主儀表板入口頁面
├── vercel.json                    # Vercel 靜態路由設定
├── requirements.txt               # Python ETL 依賴項
├── .gitignore                     # Git 忽略設定（包含 .env 與暫存檔）
└── README.md                      # 專案說明文件
```

---

## 🚀 本地開發與運行 (Local Development)

### 1. 複製儲存庫
```bash
git clone https://github.com/Dave1588/Taiwan-weather-GIS-web-application.git
cd Taiwan-weather-GIS-web-application
```

### 2. 配置 CWA API 金鑰 (選用)
在專案根目錄建立 `.env` 檔案（該檔案已被 `.gitignore` 忽略，確保安全）：
```env
CWA_API_KEY=您的_CWA_API_KEY
```
> 若無 API Key，腳本會自動使用完整 22 縣市的預設氣象資料，確保本機開發不受阻礙。

### 3. 執行氣象資料更新腳本
```bash
# 安裝依賴 (可選)
pip install -r requirements.txt

# 執行 ETL 抓取最新氣象資料
python scripts/fetch_weather.py
```

### 4. 啟動本地靜態伺服器
```bash
python -m http.server 8080 --directory public
```
打開瀏覽器訪問 [http://localhost:8080](http://localhost:8080) 即可使用！

---

## ⚙️ CI/CD 與 GitHub Actions 設定

為了讓 GitHub Actions 能夠每 3 小時自動取得 CWA 即時氣象數據：

1. 前往本 GitHub 儲存庫的 **Settings** -> **Secrets and variables** -> **Actions**。
2. 點擊 **New repository secret**：
   - **Name**: `CWA_API_KEY`
   - **Secret**: 填入您的 CWA API Key（例如：`CWA-XXXXXX...`）。
3. 前往儲存庫的 **Actions** 頁籤，即可手動觸發 `Update Weather Data` 工作流，或等待排程自動執行。

---

## 🌐 部署至 Vercel (Deployment)

本專案已配置 `vercel.json`，可直接於 Vercel 一鍵部署：

1. 登入 [Vercel](https://vercel.com/)。
2. 點擊 **Add New Project**，並匯入本 GitHub 儲存庫 `Taiwan-weather-GIS-web-application`。
3. 根目錄保持預設，設定將自動讀取 `vercel.json` 並將 `public/` 作為靜態輸出目錄。
4. 點擊 **Deploy**，數秒內即可上線！

---

## 📄 資料授權與來源宣告

- 氣象資料來源：[交通部中央氣象署開放資料平台 (CWA OpenData)](https://opendata.cwa.gov.tw/)，依政府資料開放授權條款釋出。
- 地圖圖層：[OpenStreetMap](https://www.openstreetmap.org/) 與 [CartoDB](https://carto.com/)。