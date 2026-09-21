/**
 * Taiwan Weather GIS - Application Core Logic
 * Leaflet.js interactive map, real-time CWA data integration, and responsive UI.
 */

// Weather condition to FontAwesome icon mapping
const WEATHER_ICON_MAP = [
  { match: ["雷", "陣雨"], icon: "fa-solid fa-cloud-bolt", color: "#a855f7" },
  { match: ["雨", "豪雨", "大雨"], icon: "fa-solid fa-cloud-showers-heavy", color: "#38bdf8" },
  { match: ["陰"], icon: "fa-solid fa-cloud", color: "#94a3b8" },
  { match: ["多雲時晴", "晴時多雲", "多雲"], icon: "fa-solid fa-cloud-sun", color: "#facc15" },
  { match: ["晴"], icon: "fa-solid fa-sun", color: "#fb923c" }
];

function getWeatherIcon(weatherDesc) {
  for (const item of WEATHER_ICON_MAP) {
    if (item.match.some(keyword => weatherDesc.includes(keyword))) {
      return item;
    }
  }
  return { icon: "fa-solid fa-cloud-sun", color: "#38bdf8" };
}

function getTempGrade(temp) {
  if (temp >= 30) return { grade: "hot", label: "炎熱", colorClass: "hot", badgeClass: "badge-hot", miniClass: "mini-temp-hot" };
  if (temp >= 22) return { grade: "mild", label: "舒適", colorClass: "mild", badgeClass: "badge-mild", miniClass: "mini-temp-mild" };
  return { grade: "cool", label: "涼爽", colorClass: "cool", badgeClass: "badge-cool", miniClass: "mini-temp-cool" };
}

// Global Application State
const AppState = {
  weatherData: [],
  markers: new Map(), // city -> { marker, loc }
  activeCity: null,
  activeFilter: "all",
  searchQuery: "",
  map: null,
  markerLayerGroup: null,
  baseTileLayers: {},
  currentTheme: "dark"
};

// Initial Map Setup
function initMap() {
  // Center Taiwan
  const mapCenter = [23.7, 120.9];
  const initialZoom = 7.5;

  AppState.map = L.map("map", {
    center: mapCenter,
    zoom: initialZoom,
    minZoom: 6,
    maxZoom: 16,
    zoomControl: false
  });

  // Zoom control top-left
  L.control.zoom({ position: "topleft" }).addTo(AppState.map);

  // Basemap tile layers
  AppState.baseTileLayers = {
    dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: "abcd",
      maxZoom: 19
    }),
    light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: "abcd",
      maxZoom: 19
    }),
    osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    })
  };

  // Default to Dark theme
  AppState.baseTileLayers.dark.addTo(AppState.map);

  // Marker layer group
  AppState.markerLayerGroup = L.layerGroup().addTo(AppState.map);

  // Reset Center button
  document.getElementById("btnResetMap").addEventListener("click", () => {
    AppState.map.flyTo(mapCenter, initialZoom, { duration: 1.2 });
  });

  // Basemap Selector buttons
  document.querySelectorAll(".basemap-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const targetTheme = btn.dataset.theme;
      if (targetTheme === AppState.currentTheme) return;

      document.querySelectorAll(".basemap-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      AppState.map.removeLayer(AppState.baseTileLayers[AppState.currentTheme]);
      AppState.baseTileLayers[targetTheme].addTo(AppState.map);
      AppState.currentTheme = targetTheme;
    });
  });
}

// Fetch and Render Weather Data
async function loadWeatherData() {
  const listContainer = document.getElementById("countyCardList");
  const refreshBtn = document.getElementById("btnRefresh");
  refreshBtn.classList.add("fa-spin");

  try {
    const timestamp = new Date().getTime();
    const res = await fetch(`data/weather.json?t=${timestamp}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const payload = await res.json();
    AppState.weatherData = payload.locations || [];

    // Format updated timestamp & source badge
    updateHeaderTimestamp(payload.updated_at, payload.source);

    // Compute stats
    computeMetrics(AppState.weatherData);

    // Render Markers & Cards
    renderMapMarkers();
    renderSidebarList();

    // Auto-select first city or maintain active
    if (AppState.weatherData.length > 0) {
      const current = AppState.activeCity 
        ? AppState.weatherData.find(c => c.city === AppState.activeCity.city) 
        : AppState.weatherData[0];
      selectCity(current || AppState.weatherData[0], false);
    }
  } catch (error) {
    console.error("Failed to load weather data:", error);
    listContainer.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-triangle-exclamation" style="color: #f43f5e; font-size: 2rem;"></i>
        <span>無法讀取氣象數據，請確認資料來源。</span>
      </div>
    `;
  } finally {
    setTimeout(() => refreshBtn.classList.remove("fa-spin"), 500);
  }
}

// Header metrics calculation
function computeMetrics(locations) {
  if (!locations || locations.length === 0) return;

  let totalTemp = 0;
  let maxTItem = locations[0];
  let minTItem = locations[0];
  let maxRainItem = locations[0];

  let hotCount = 0;
  let mildCount = 0;
  let coolCount = 0;

  locations.forEach(loc => {
    totalTemp += loc.maxT;
    if (loc.maxT > maxTItem.maxT) maxTItem = loc;
    if (loc.minT < minTItem.minT) minTItem = loc;

    const popVal = parseInt(loc.pop.replace("%", ""), 10) || 0;
    const maxPopVal = parseInt(maxRainItem.pop.replace("%", ""), 10) || 0;
    if (popVal > maxPopVal) maxRainItem = loc;

    if (loc.maxT >= 30) hotCount++;
    else if (loc.maxT >= 22) mildCount++;
    else coolCount++;
  });

  const avgTemp = (totalTemp / locations.length).toFixed(1);

  document.getElementById("statAvgTemp").textContent = `${avgTemp} °C`;
  document.getElementById("statMaxTemp").textContent = `${maxTItem.city} ${maxTItem.maxT}°`;
  document.getElementById("statMinTemp").textContent = `${minTItem.city} ${minTItem.minT}°`;
  
  const topPopVal = parseInt(maxRainItem.pop.replace("%", ""), 10) || 0;
  document.getElementById("statRainAlert").textContent = topPopVal > 0 
    ? `${maxRainItem.city} ${maxRainItem.pop}` 
    : "全台降雨機率低";

  // Tab counts
  document.getElementById("countAll").textContent = locations.length;
  document.getElementById("countHot").textContent = hotCount;
  document.getElementById("countMild").textContent = mildCount;
  document.getElementById("countCool").textContent = coolCount;
}

// Format timestamp & source badge
function updateHeaderTimestamp(isoString, source) {
  const el = document.getElementById("lastUpdatedTime");
  const badgeEl = document.getElementById("dataSourceBadge");

  if (badgeEl) {
    if (source === "CWA OpenData Live API") {
      badgeEl.textContent = "CWA 即時 API";
      badgeEl.className = "source-badge source-live";
      badgeEl.title = "已成功連線至交通部中央氣象署 OpenData API";
    } else {
      badgeEl.textContent = "離線備援資料";
      badgeEl.className = "source-badge source-fallback";
      badgeEl.title = "目前使用離線備援資料";
    }
  }

  if (!isoString) {
    el.textContent = "即時連線中";
    return;
  }
  const date = new Date(isoString);
  const timeStr = date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  el.textContent = `更新於 ${timeStr}`;
}

// Create custom animated marker
function createMarkerIcon(loc) {
  const gradeInfo = getTempGrade(loc.maxT);
  const iconInfo = getWeatherIcon(loc.weather);

  const html = `
    <div class="gis-marker-pin pin-${gradeInfo.grade}" data-city="${loc.city}">
      <div class="pin-pulse"></div>
      <div class="marker-badge">
        <i class="${iconInfo.icon}"></i>
        <span>${loc.maxT}°</span>
      </div>
      <div class="marker-city-tag">${loc.city}</div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: "custom-leaflet-pin",
    iconSize: [60, 48],
    iconAnchor: [30, 24],
    popupAnchor: [0, -26]
  });
}

// Build popup HTML
function createPopupContent(loc) {
  const gradeInfo = getTempGrade(loc.maxT);
  const iconInfo = getWeatherIcon(loc.weather);

  return `
    <div class="popup-card">
      <div class="popup-header">
        <span class="popup-city">${loc.city}</span>
        <span class="popup-grade-badge ${gradeInfo.badgeClass}">${gradeInfo.label}</span>
      </div>
      <div class="popup-body">
        <div class="popup-weather">
          <i class="${iconInfo.icon}" style="color: ${iconInfo.color}"></i>
          <span>${loc.weather}</span>
        </div>
        <div class="popup-temp-range">
          ${loc.minT}°C ~ ${loc.maxT}°C
        </div>
        <div class="popup-pop">
          <i class="fa-solid fa-droplet"></i>
          <span>降雨機率：${loc.pop}</span>
        </div>
        ${loc.ci ? `<div class="popup-comfort"><i class="fa-solid fa-heart-pulse"></i> 體感：${loc.ci}</div>` : ""}
      </div>
    </div>
  `;
}

// Render Leaflet Markers
function renderMapMarkers() {
  AppState.markerLayerGroup.clearLayers();
  AppState.markers.clear();

  AppState.weatherData.forEach(loc => {
    const icon = createMarkerIcon(loc);
    const marker = L.marker([loc.lat, loc.lon], { icon: icon });

    marker.bindPopup(createPopupContent(loc), {
      closeButton: true,
      autoPan: true,
      autoPanPadding: [50, 50]
    });

    marker.on("click", () => {
      selectCity(loc, false);
    });

    AppState.markers.set(loc.city, { marker, loc });
    marker.addTo(AppState.markerLayerGroup);
  });
}

// Filter weather data based on search and temperature grade
function getFilteredLocations() {
  return AppState.weatherData.filter(loc => {
    // Search filter
    if (AppState.searchQuery) {
      const q = AppState.searchQuery.toLowerCase();
      const matchCity = loc.city.toLowerCase().includes(q);
      const matchWx = loc.weather.toLowerCase().includes(q);
      if (!matchCity && !matchWx) return false;
    }

    // Grade filter
    if (AppState.activeFilter !== "all") {
      const gradeInfo = getTempGrade(loc.maxT);
      if (gradeInfo.grade !== AppState.activeFilter) return false;
    }

    return true;
  });
}

// Render Sidebar Cards List
function renderSidebarList() {
  const container = document.getElementById("countyCardList");
  const filtered = getFilteredLocations();
  document.getElementById("visibleCountyCount").textContent = `${filtered.length} 處測站`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 1.75rem;"></i>
        <span>無符合條件的縣市資料</span>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(loc => {
    const gradeInfo = getTempGrade(loc.maxT);
    const iconInfo = getWeatherIcon(loc.weather);
    const isActive = AppState.activeCity && AppState.activeCity.city === loc.city ? "active" : "";

    return `
      <div class="county-mini-card ${isActive}" data-city="${loc.city}">
        <div class="mini-card-left">
          <i class="${iconInfo.icon}" style="color: ${iconInfo.color}; font-size: 1.3rem;"></i>
          <div>
            <div class="mini-city-name">${loc.city}</div>
            <div class="mini-weather-desc">${loc.weather}</div>
          </div>
        </div>
        <div class="mini-card-right">
          <div class="mini-rain-chance" title="降雨機率">
            <i class="fa-solid fa-droplet"></i>
            <span>${loc.pop}</span>
          </div>
          <div class="mini-temp-badge ${gradeInfo.miniClass}">
            ${loc.maxT}°
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Attach click listener to each mini card
  container.querySelectorAll(".county-mini-card").forEach(card => {
    card.addEventListener("click", () => {
      const cityName = card.dataset.city;
      const targetLoc = AppState.weatherData.find(c => c.city === cityName);
      if (targetLoc) {
        selectCity(targetLoc, true);
      }
    });
  });

  // Sync marker visibility on map with filter
  AppState.markers.forEach(({ marker, loc }) => {
    const isVisible = filtered.some(f => f.city === loc.city);
    if (isVisible) {
      if (!AppState.markerLayerGroup.hasLayer(marker)) {
        AppState.markerLayerGroup.addLayer(marker);
      }
    } else {
      if (AppState.markerLayerGroup.hasLayer(marker)) {
        AppState.markerLayerGroup.removeLayer(marker);
      }
    }
  });
}

// Select and Highlight City
function selectCity(loc, flyToLocation = true) {
  AppState.activeCity = loc;

  // Update Active Detail Card in Sidebar
  renderActiveCard(loc);

  // Highlight list item
  document.querySelectorAll(".county-mini-card").forEach(c => {
    if (c.dataset.city === loc.city) {
      c.classList.add("active");
      c.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      c.classList.remove("active");
    }
  });

  // Map Pan and Open Popup
  const markerObj = AppState.markers.get(loc.city);
  if (markerObj && markerObj.marker) {
    if (flyToLocation) {
      AppState.map.flyTo([loc.lat, loc.lon], 9, {
        duration: 1
      });
      setTimeout(() => {
        markerObj.marker.openPopup();
      }, 500);
    }
  }
}

// Render Highlighted Card in Sidebar
function renderActiveCard(loc) {
  const container = document.getElementById("activeCityCard");
  const gradeInfo = getTempGrade(loc.maxT);
  const iconInfo = getWeatherIcon(loc.weather);

  container.innerHTML = `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h2 class="detail-city-name">${loc.city}</h2>
          <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-location-dot"></i> 北緯 ${loc.lat.toFixed(2)}° · 東經 ${loc.lon.toFixed(2)}°</span>
        </div>
        <span class="detail-badge ${gradeInfo.badgeClass}">${gradeInfo.label} (${loc.maxT}°C)</span>
      </div>

      <div class="detail-main">
        <div class="detail-temp-display">
          <span class="temp-number" style="color: ${gradeInfo.grade === 'hot' ? 'var(--temp-hot)' : (gradeInfo.grade === 'mild' ? 'var(--temp-mild)' : 'var(--temp-cool)')}">${loc.maxT}</span>
          <span class="temp-unit">°C</span>
        </div>
        <div class="detail-weather-info">
          <div class="weather-condition">
            <i class="${iconInfo.icon}" style="color: ${iconInfo.color}; font-size: 1.25rem;"></i>
            <span>${loc.weather}</span>
          </div>
          ${loc.ci ? `<div class="weather-comfort">${loc.ci}</div>` : ""}
        </div>
      </div>

      <div class="detail-stats-grid">
        <div class="detail-stat-item">
          <div class="stat-icon icon-temp">
            <i class="fa-solid fa-temperature-half"></i>
          </div>
          <div class="stat-text">
            <span class="stat-label">溫差範圍</span>
            <span class="stat-val">${loc.minT}°C ~ ${loc.maxT}°C</span>
          </div>
        </div>
        <div class="detail-stat-item">
          <div class="stat-icon icon-rain">
            <i class="fa-solid fa-cloud-showers-heavy"></i>
          </div>
          <div class="stat-text">
            <span class="stat-label">降雨機率</span>
            <span class="stat-val">${loc.pop}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Setup Event Listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById("citySearchInput");
  const clearBtn = document.getElementById("btnClearSearch");

  searchInput.addEventListener("input", (e) => {
    AppState.searchQuery = e.target.value.trim();
    clearBtn.style.display = AppState.searchQuery ? "block" : "none";
    renderSidebarList();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    AppState.searchQuery = "";
    clearBtn.style.display = "none";
    renderSidebarList();
    searchInput.focus();
  });

  // Filter tabs
  const filterTabs = document.querySelectorAll(".tab-btn");
  filterTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      filterTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.activeFilter = btn.dataset.filter;
      renderSidebarList();
    });
  });

  // Refresh Button
  document.getElementById("btnRefresh").addEventListener("click", () => {
    loadWeatherData();
  });

  // Mobile Sidebar Toggle
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("btnToggleSidebar");
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// Bootstrap Application
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupEventListeners();
  loadWeatherData();
});
