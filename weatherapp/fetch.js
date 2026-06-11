// ============================================================
//  SkyPulse – Weather App JS
//  Uses OpenWeatherMap Current Weather API
// ============================================================

const apiKey = "75e342d1899dcab7023ac3a44c59d6f7"; // OpenWeatherMap API key

// ─── Live Clock ───────────────────────────────────────────
function updateClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const el = document.getElementById("currentDateTime");
    if (el) el.innerHTML = `${dateStr}<br>${timeStr}`;
}
setInterval(updateClock, 1000);
updateClock();

// ─── Enter Key Trigger ────────────────────────────────────
document.getElementById("cityInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") getWeather();
});

// ─── UI Helpers ───────────────────────────────────────────
function showLoader(show) {
    document.getElementById("loader").classList.toggle("active", show);
}

function showError(msg) {
    const banner = document.getElementById("errorBanner");
    document.getElementById("errorMsg").textContent = msg;
    banner.classList.add("active");
    setTimeout(() => banner.classList.remove("active"), 4000);
}

function showDashboard(show) {
    const dash = document.getElementById("weatherDashboard");
    dash.classList.toggle("visible", show);
}

// ─── Format Unix Timestamp ────────────────────────────────
function formatTime(unixTs, offsetSec) {
    const d = new Date((unixTs + offsetSec) * 1000);
    return d.toUTCString().slice(17, 22); // HH:MM
}

function formatDuration(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m of daylight`;
}

// ─── Wind Direction ───────────────────────────────────────
function windDirection(deg) {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(deg / 45) % 8];
}

// ─── Weather Emoji Mapper ─────────────────────────────────
function conditionEmoji(iconCode, description) {
    const d = description.toLowerCase();
    if (d.includes("thunder"))  return "⛈️";
    if (d.includes("drizzle"))  return "🌦️";
    if (d.includes("rain"))     return "🌧️";
    if (d.includes("snow"))     return "❄️";
    if (d.includes("mist") || d.includes("fog") || d.includes("haze")) return "🌫️";
    if (d.includes("clear"))    return "☀️";
    if (d.includes("few clouds")) return "🌤️";
    if (d.includes("scattered")) return "⛅";
    if (d.includes("broken") || d.includes("overcast")) return "☁️";
    return "🌡️";
}

// ─── Simulate 24-Hour Forecast ────────────────────────────
function generateForecast(baseTemp, iconCode, description, tzOffset) {
    const now = new Date();
    const hourNow = now.getUTCHours() + Math.round(tzOffset / 3600);
    const emoji = conditionEmoji(iconCode, description);

    const tempVariations = [0, -1, -2, -3, -3, -2, -1, 0, 1, 2, 3, 3,
                            2, 1, 0, -1, -2, -2, -1, 0, 1, 2, 1, 0];
    const desc = description;

    const scroll = document.getElementById("forecastScroll");
    scroll.innerHTML = "";

    for (let i = 0; i < 24; i++) {
        const hour = (hourNow + i) % 24;
        const isNow = i === 0;
        const temp = Math.round(baseTemp + tempVariations[i]);
        const label = isNow ? "Now" : `${String(hour).padStart(2, "0")}:00`;

        // Daytime vs nighttime icon adjustment
        const isDay = hour >= 6 && hour < 20;
        let emojiForHour = emoji;
        if (!isDay && (desc.includes("clear") || desc.includes("few clouds"))) {
            emojiForHour = "🌙";
        }

        const item = document.createElement("div");
        item.className = `forecast-item${isNow ? " now" : ""}`;
        item.innerHTML = `
            <span class="forecast-hour">${label}</span>
            <span class="forecast-emoji">${emojiForHour}</span>
            <span class="forecast-temp">${temp}°</span>
            <span class="forecast-desc">${desc.split(" ").slice(0, 2).join(" ")}</span>
        `;
        scroll.appendChild(item);
    }
}

// ─── AQI / Condition Index ────────────────────────────────
function setConditionIndex(data) {
    // Derive a simple "comfort index" from humidity + wind + cloud
    const h = data.main.humidity;        // 0–100
    const w = Math.min(data.wind.speed * 3, 100); // scaled
    const c = data.clouds.all;           // 0–100
    const score = Math.round((h * 0.4 + w * 0.3 + c * 0.3));

    const pointer = document.getElementById("aqiPointer");
    pointer.style.left = `${Math.min(score, 98)}%`;

    const descs = [
        { max: 20,  text: "🟢 Excellent conditions – Clear skies and calm winds." },
        { max: 40,  text: "🟡 Good conditions – Comfortable with mild breezes." },
        { max: 60,  text: "🟠 Moderate – Some clouds or humidity may be present." },
        { max: 80,  text: "🔴 Poor – Strong winds or high humidity expected." },
        { max: 100, text: "🔵 Hazardous – Extreme conditions, stay indoors." },
    ];
    const match = descs.find(d => score <= d.max) || descs[descs.length - 1];
    document.getElementById("aqiDesc").textContent = match.text;
}

// ─── Main Fetch ───────────────────────────────────────────
async function getWeather() {
    const city = document.getElementById("cityInput").value.trim();

    if (!city) {
        showError("Please enter a city name.");
        return;
    }

    // Hide old results, show loader
    showDashboard(false);
    document.getElementById("errorBanner").classList.remove("active");
    showLoader(true);

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.cod !== 200) {
            throw new Error(data.message || "City not found.");
        }

        populateWeather(data);
        showDashboard(true);

    } catch (err) {
        showError(err.message || "Something went wrong. Please try again.");
        console.error(err);
    } finally {
        showLoader(false);
    }
}

// ─── Populate All Cards ───────────────────────────────────
function populateWeather(data) {
    const tz = data.timezone; // seconds offset

    // ── Hero Card ──
    document.getElementById("cityName").textContent    = data.name;
    document.getElementById("countryName").textContent = `${data.sys.country} · ${data.weather[0].main}`;
    document.getElementById("mainTemp").textContent    = Math.round(data.main.temp);
    document.getElementById("weatherDesc").textContent = data.weather[0].description;
    document.getElementById("tempMax").textContent     = `${Math.round(data.main.temp_max)}°C`;
    document.getElementById("tempMin").textContent     = `${Math.round(data.main.temp_min)}°C`;

    const iconSrc = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
    document.getElementById("weatherIcon").src = iconSrc;

    const updated = new Date();
    document.getElementById("lastUpdated").textContent = `Updated: ${updated.toLocaleTimeString()}`;

    // ── Stats Grid ──
    const humidity = data.main.humidity;
    document.getElementById("humidityVal").textContent  = `${humidity}%`;
    document.getElementById("humidityBar").style.width  = `${humidity}%`;

    document.getElementById("windVal").textContent      = `${data.wind.speed} m/s`;
    document.getElementById("windDir").textContent      = `Direction: ${windDirection(data.wind.deg || 0)}`;

    const feelsLike = Math.round(data.main.feels_like);
    const feelsOffset = feelsLike - Math.round(data.main.temp);
    document.getElementById("feelsVal").textContent     = `${feelsLike}°C`;
    document.getElementById("feelsDesc").textContent    = feelsOffset < -2 ? "Feels colder" : feelsOffset > 2 ? "Feels warmer" : "Similar to actual";

    document.getElementById("pressureVal").textContent  = data.main.pressure;

    const vis = data.visibility ? (data.visibility / 1000).toFixed(1) : "N/A";
    document.getElementById("visibilityVal").textContent = vis;

    const cloud = data.clouds.all;
    document.getElementById("cloudVal").textContent     = `${cloud}%`;
    document.getElementById("cloudBar").style.width     = `${cloud}%`;

    // ── Sun Card ──
    const sunrise = formatTime(data.sys.sunrise, tz);
    const sunset  = formatTime(data.sys.sunset,  tz);
    document.getElementById("sunriseTime").textContent = sunrise;
    document.getElementById("sunsetTime").textContent  = sunset;
    document.getElementById("daylightDuration").textContent =
        formatDuration(data.sys.sunset - data.sys.sunrise);

    // Sun arc position based on current time
    const nowUtc    = Math.floor(Date.now() / 1000);
    const dayLen    = data.sys.sunset - data.sys.sunrise;
    const elapsed   = Math.max(0, Math.min(nowUtc - data.sys.sunrise, dayLen));
    const progress  = dayLen > 0 ? elapsed / dayLen : 0.5;
    document.getElementById("arcSun").style.left = `${Math.round(progress * 100)}%`;

    // ── Atmosphere Card ──
    // Approximate dew point from Magnus formula
    const T = data.main.temp;
    const RH = data.main.humidity;
    const dewPoint = Math.round(T - ((100 - RH) / 5));
    document.getElementById("dewPoint").textContent   = `${dewPoint}°C`;
    document.getElementById("seaLevel").textContent   = data.main.sea_level ? `${data.main.sea_level} hPa` : "N/A";
    document.getElementById("groundLevel").textContent = data.main.grnd_level ? `${data.main.grnd_level} hPa` : "N/A";
    document.getElementById("windGust").textContent   = data.wind.gust ? `${data.wind.gust} m/s` : "N/A";

    // ── Forecast ──
    generateForecast(data.main.temp, data.weather[0].icon, data.weather[0].description, tz);

    // ── Condition Index ──
    setConditionIndex(data);
}