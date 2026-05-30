let hourlyData = null;
let charts = {};
let autocompleteData = [];
let activeIndex = -1;
let debounceTimer = null;

function closeDropdown() {
  document.getElementById("autocompleteDropdown").style.display = "none";
  autocompleteData = [];
  activeIndex = -1;
}

function highlightItem() {
  document.querySelectorAll(".autocomplete-item").forEach((el, i) =>
    el.classList.toggle("active", i === activeIndex));
}

function renderDropdown() {
  const dropdown = document.getElementById("autocompleteDropdown");
  if (autocompleteData.length === 0) { closeDropdown(); return; }
  dropdown.innerHTML = autocompleteData.map((r, i) => {
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    return `<div class="autocomplete-item${i === activeIndex ? " active" : ""}" onmousedown="selectSuggestion(${i})">${label}</div>`;
  }).join("");
  dropdown.style.display = "block";
}

async function fetchSuggestions(query) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=en&format=json`);
    const data = await res.json();
    const raw = data.results || [];
    const q = query.toLowerCase();
    const keepCodes = new Set(["PPLX", "PPLR", "PPLA", "PPLA2", "PPLA3"]);
    const filtered = raw.filter(r => {
      const pop = r.population || 0;
      const code = r.feature_code || "";
      if (pop >= 10000) return true;
      if (code.startsWith("PPL") && pop >= 1000) return true;
      if (keepCodes.has(code)) return true;
      if ((r.admin1 || "").toLowerCase().includes(q)) return true;
      if ((r.admin2 || "").toLowerCase().includes(q)) return true;
      return false;
    });
    filtered.sort((a, b) => (b.population || 0) - (a.population || 0));
    autocompleteData = filtered.slice(0, 8);
    renderDropdown();
  } catch (e) {
    autocompleteData = [];
    closeDropdown();
  }
}

function selectSuggestion(index) {
  const r = autocompleteData[index];
  if (!r) return;
  const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  document.getElementById("city").value = label;
  closeDropdown();
  fetchWeatherByCoords(r.latitude, r.longitude, label);
}

function handleCityKeydown(e) {
  const open = document.getElementById("autocompleteDropdown").style.display !== "none";
  if (e.key === "ArrowDown") {
    if (!open) return;
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, autocompleteData.length - 1);
    highlightItem();
  } else if (e.key === "ArrowUp") {
    if (!open) return;
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, -1);
    highlightItem();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (open && activeIndex >= 0) selectSuggestion(activeIndex);
    else { closeDropdown(); searchCity(); }
  } else if (e.key === "Escape") {
    closeDropdown();
  }
}

function setOverviewMessage(text) {
  document.getElementById("overviewPanel").innerHTML =
    `<div class="overview-placeholder">${text}</div>`;
}

async function searchCity() {
  const city = document.getElementById("city").value.trim();
  if (!city) return alert("Please enter a city!");
  closeDropdown();
  document.getElementById("loading").style.display = "block";
  document.getElementById("results").style.display = "none";
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      document.getElementById("loading").style.display = "none";
      setOverviewMessage("No results found. Try a different city name.");
      return;
    }
    const { latitude, longitude, name, country } = geoData.results[0];
    await fetchWeatherByCoords(latitude, longitude, `${name}, ${country}`);
  } catch (e) {
    alert("Error loading data. Please try again.");
    document.getElementById("loading").style.display = "none";
    console.error(e);
  }
}

async function fetchWeatherByCoords(latitude, longitude, displayName) {
  document.getElementById("loading").style.display = "block";
  document.getElementById("results").style.display = "none";
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,relative_humidity_2m,uv_index,weather_code&temperature_unit=celsius&wind_speed_unit=ms&forecast_days=2&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    hourlyData = await weatherRes.json();
    hourlyData.cityName = displayName;
    document.getElementById("loading").style.display = "none";
    document.getElementById("timeControls").style.display = "block";
    document.getElementById("results").style.display = "block";
    updateResults();
  } catch (e) {
    alert("Error loading data. Please try again.");
    document.getElementById("loading").style.display = "none";
    console.error(e);
  }
}

document.getElementById("startHour").addEventListener("input", updateResults);
document.getElementById("endHour").addEventListener("input", updateResults);

document.getElementById("city").addEventListener("input", function() {
  clearTimeout(debounceTimer);
  activeIndex = -1;
  setOverviewMessage("Search a city to view conditions");
  const val = this.value.trim();
  if (val.length < 2) { closeDropdown(); return; }
  debounceTimer = setTimeout(() => fetchSuggestions(val), 300);
});

document.addEventListener("click", function(e) {
  if (!document.querySelector(".search-wrapper").contains(e.target)) {
    closeDropdown();
  }
});

function formatHour(offset) {
  if (offset === 0) return "Now";
  const d = new Date();
  d.setHours(d.getHours() + offset);
  const h = d.getHours();
  const day = offset >= 24 ? " (next day)" : "";
  return `${h}:00${day}`;
}

function updateResults() {
  if (!hourlyData) return;

  let sliderStart = parseInt(document.getElementById("startHour").value);
  let sliderEnd   = parseInt(document.getElementById("endHour").value);

  if (sliderEnd <= sliderStart) {
    sliderEnd = sliderStart + 1;
    document.getElementById("endHour").value = sliderEnd;
  }

  document.getElementById("startDisplay").innerText = formatHour(sliderStart);
  document.getElementById("endDisplay").innerText   = formatHour(sliderEnd);

  const now = new Date();
  const nowIndex = hourlyData.hourly.time.findIndex(t => {
    const d = new Date(t);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth()    === now.getMonth()    &&
           d.getDate()     === now.getDate()     &&
           d.getHours()    === now.getHours();
  });

  const offset = nowIndex >= 0 ? nowIndex : 0;
  renderResults(offset + sliderStart, offset + sliderEnd, sliderStart, sliderEnd);
}

function updateBackground(weatherCode, hour) {
  document.body.classList.remove('bg-sunny-day', 'bg-rainy', 'bg-cloudy', 'bg-night');
  if (hour < 6 || hour >= 19) {
    document.body.classList.add('bg-night');
  } else if (weatherCode >= 51) {
    document.body.classList.add('bg-rainy');
  } else if (weatherCode >= 1) {
    document.body.classList.add('bg-cloudy');
  } else {
    document.body.classList.add('bg-sunny-day');
  }
}

function renderResults(start, end, sliderStart, sliderEnd) {
  if (!hourlyData) return;

  const h = hourlyData.hourly;
  const slice = (arr) => arr.slice(start, end + 1);

  const temps = slice(h.temperature_2m);
  const feels = slice(h.apparent_temperature);
  const rain  = slice(h.precipitation_probability);
  const wind  = slice(h.wind_speed_10m);
  const humid = slice(h.relative_humidity_2m);
  const uv    = slice(h.uv_index);

  const labels = [];
  for (let i = 0; i <= end - start; i++) labels.push(formatHour(sliderStart + i));

  const minTemp  = Math.min(...temps).toFixed(1);
  const maxTemp  = Math.max(...temps).toFixed(1);
  const avgFeel  = (feels.reduce((a,b)=>a+b,0)/feels.length).toFixed(1);
  const maxRain  = Math.max(...rain);
  const maxWind  = Math.max(...wind).toFixed(1);
  const maxUV    = Math.max(...uv).toFixed(1);
  const avgHumid = Math.round(humid.reduce((a,b)=>a+b,0)/humid.length);

  updateBackground(h.weather_code[start], new Date().getHours());

  const advice    = generateAdvice(minTemp, maxTemp, avgFeel, maxRain, maxWind, maxUV, avgHumid);
  const scenarios = generateScenarios(avgFeel, maxRain, maxWind, maxUV, avgHumid);
  const summary   = generateSummary(maxTemp, maxRain, maxWind, maxUV, sliderStart);

  // Fill overview panel
  document.getElementById("overviewPanel").innerHTML = `
    <div class="overview-city">${hourlyData.cityName}</div>
    <div class="overview-time">${formatHour(sliderStart)} &rarr; ${formatHour(sliderEnd)}</div>
    <div class="overview-temp">${parseFloat(temps[0]).toFixed(1)}<span class="temp-unit">&thinsp;°C</span></div>
    <div class="overview-feels">Feels like ${avgFeel}°C</div>
    <div class="overview-summary">${summary}</div>
    <div class="overview-mini-stats">
      <div class="mini-stat">
        <span class="mini-stat-label">Rain</span>
        <span class="mini-stat-value">${maxRain}%</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-label">Wind</span>
        <span class="mini-stat-value">${maxWind} m/s</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-label">UV Index</span>
        <span class="mini-stat-value">${maxUV}</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-label">Humidity</span>
        <span class="mini-stat-value">${avgHumid}%</span>
      </div>
    </div>
  `;

  // Fill results: charts + conditions + advice + activity tips
  document.getElementById("results").innerHTML = `
    <div class="charts-row">
      <div class="card">
        <div class="card-title">Temperature &amp; Feels Like</div>
        <div class="chart-container"><canvas id="tempChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Precipitation Probability</div>
        <div class="chart-container"><canvas id="rainChart"></canvas></div>
      </div>
    </div>

    <div class="charts-row">
      <div class="card">
        <div class="card-title">Wind &amp; Humidity</div>
        <div class="chart-container"><canvas id="windChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Conditions</div>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-label">Temp Range</div>
            <div class="stat-value">${minTemp}° <span style="opacity:.35">—</span> ${maxTemp}°</div>
          </div>
          <div class="stat">
            <div class="stat-label">Feels Like</div>
            <div class="stat-value">${avgFeel}<span class="stat-unit"> °C</span></div>
          </div>
          <div class="stat">
            <div class="stat-label">Max Wind</div>
            <div class="stat-value">${maxWind}<span class="stat-unit"> m/s</span></div>
          </div>
          <div class="stat">
            <div class="stat-label">Max UV</div>
            <div class="stat-value">${maxUV}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Rain Chance</div>
            <div class="stat-value">${maxRain}<span class="stat-unit">%</span></div>
          </div>
          <div class="stat">
            <div class="stat-label">Humidity</div>
            <div class="stat-value">${avgHumid}<span class="stat-unit">%</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">What to Wear &amp; Bring</div>
      <div class="advice-list">
        ${advice.map(a => `<div class="advice-item ${a.level || ''}">${a.text}</div>`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Activity Tips</div>
      <div class="scenario-grid">
        ${scenarios.map(s => `
          <div class="scenario-card">
            <div class="scenario-icon">${s.icon}</div>
            <div class="scenario-name">${s.title}</div>
            <div class="scenario-tip">${s.tip}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  renderCharts(labels, temps, feels, rain, wind, humid);
}

function renderCharts(labels, temps, feels, rain, wind, humid) {
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const gridColor   = 'rgba(255,255,255,0.07)';
  const tickColor   = 'rgba(255,255,255,0.4)';
  const legendColor = 'rgba(255,255,255,0.6)';
  const tickFont    = { size: 11 };

  const xAxis = { grid: { color: gridColor }, ticks: { color: tickColor, font: tickFont } };
  const yAxis = { grid: { color: gridColor }, ticks: { color: tickColor, font: tickFont } };

  charts.temp = new Chart(document.getElementById('tempChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Temperature (°C)', data: temps, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.12)', tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 5 },
        { label: 'Feels Like (°C)',  data: feels, borderColor: '#fbbf24', backgroundColor: 'transparent',            tension: 0.3, borderDash: [5,5], pointRadius: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: legendColor, font: tickFont, boxWidth: 12 } } },
      scales: { x: xAxis, y: yAxis }
    }
  });

  charts.rain = new Chart(document.getElementById('rainChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Rain Chance (%)', data: rain, backgroundColor: 'rgba(96,165,250,0.5)', borderColor: '#60a5fa', borderWidth: 1, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: legendColor, font: tickFont, boxWidth: 12 } } },
      scales: {
        x: xAxis,
        y: { max: 100, beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor, font: tickFont } }
      }
    }
  });

  charts.wind = new Chart(document.getElementById('windChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Wind (m/s)',   data: wind,  borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)',  tension: 0.3, yAxisID: 'y',  pointRadius: 3 },
        { label: 'Humidity (%)', data: humid, borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', tension: 0.3, yAxisID: 'y1', pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: legendColor, font: tickFont, boxWidth: 12 } } },
      scales: {
        x:  xAxis,
        y:  { type: 'linear', position: 'left',  grid: { color: gridColor }, ticks: { color: tickColor, font: tickFont }, title: { display: true, text: 'Wind (m/s)',   color: tickColor, font: { size: 10 } } },
        y1: { type: 'linear', position: 'right', max: 100, grid: { drawOnChartArea: false }, ticks: { color: tickColor, font: tickFont }, title: { display: true, text: 'Humidity (%)', color: tickColor, font: { size: 10 } } }
      }
    }
  });
}

function generateSummary(maxTemp, maxRain, maxWind, maxUV, sliderStart) {
  const t = parseFloat(maxTemp);
  const w = parseFloat(maxWind);
  const u = parseFloat(maxUV);
  const hour = (new Date().getHours() + sliderStart) % 24;
  const isDay = hour >= 6 && hour < 19;
  const timeLabel = hour >= 17 ? "this evening" : hour >= 12 ? "this afternoon" : "today";

  if (maxRain > 60) return `Bring an umbrella, it's looking pretty wet out there ${timeLabel}.`;
  if (u > 5 && isDay) return `Strong sun ${timeLabel}, you'll want sunscreen if you're out for more than 20 minutes.`;
  if (t > 30) return `Hot one ${timeLabel}, stay hydrated and avoid being outside during peak hours.`;
  if (t < 5) return `Bundle up, it's genuinely cold out there ${timeLabel}.`;
  if (w > 8) return `Pretty gusty ${timeLabel}, maybe skip the umbrella and grab a windbreaker instead.`;
  return `Solid day to be outside, nothing to worry about.`;
}

function generateAdvice(minT, maxT, feel, rain, wind, uv, humid) {
  const advice = [];
  const f = parseFloat(feel);

  if (f >= 28)        advice.push({ text: "T-shirt and shorts. It's hot out there.",              level: "advice-warning" });
  else if (f >= 22)   advice.push({ text: "Light long sleeve or t-shirt. Comfortable weather." });
  else if (f >= 15)   advice.push({ text: "Add a light jacket or cardigan." });
  else if (f >= 8)    advice.push({ text: "Sweater and a medium coat. It's chilly." });
  else if (f >= 0)    advice.push({ text: "Heavy coat and scarf. Bundle up.",                     level: "advice-warning" });
  else                advice.push({ text: "Puffer jacket, gloves, and hat. Freezing.",             level: "advice-danger" });

  if (maxT - minT >= 8) advice.push({ text: `Big temperature swing (${minT}° to ${maxT}°). Wear layers.`, level: "advice-warning" });

  if (rain >= 70)       advice.push({ text: "High rain chance. Bring an umbrella and waterproof shoes.",    level: "advice-danger"  });
  else if (rain >= 40)  advice.push({ text: "Possible rain. Pack a foldable umbrella.",                     level: "advice-warning" });
  else if (rain >= 20)  advice.push({ text: "Slight chance of rain. Maybe bring one just in case." });

  if (wind >= 10)       advice.push({ text: "Strong wind. Avoid loose hats. Consider a windproof jacket.", level: "advice-danger"  });
  else if (wind >= 7)   advice.push({ text: "Windy. Consider a windbreaker.",                               level: "advice-warning" });

  if (uv >= 8)          advice.push({ text: "Very high UV. SPF 50+, hat, and sunglasses are essential.",   level: "advice-danger"  });
  else if (uv >= 6)     advice.push({ text: "High UV. Apply sunscreen and wear sunglasses.",                level: "advice-warning" });
  else if (uv >= 3)     advice.push({ text: "Moderate UV. Sunscreen recommended." });

  if (humid >= 80)      advice.push({ text: "Very humid. Wear breathable fabrics and stay hydrated.",      level: "advice-warning" });
  else if (humid <= 30) advice.push({ text: "Very dry air. Use moisturizer and lip balm. Hydrate.",        level: "advice-warning" });

  return advice;
}

const ICONS = {
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>`,
  activity:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  users:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  camera:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  droplet:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
  shield:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
};

function generateScenarios(feel, rain, wind, uv, humid) {
  const f = parseFloat(feel);
  return [
    {
      icon:  ICONS.briefcase,
      title: "Work / Commute",
      tip:   rain >= 40 ? "Leave 10 min early — rain slows transit." : (f >= 28 ? "Carry water; bring a backup shirt." : "Normal commute. Check transit updates.")
    },
    {
      icon:  ICONS.activity,
      title: "Outdoor Exercise",
      tip:   uv >= 6 ? "Run early morning or after 5 pm to avoid UV." : (f <= 5 ? "Warm up indoors first. Cover ears." : f >= 28 ? "Hydrate every 15 min. Avoid midday." : "Great conditions for a run.")
    },
    {
      icon:  ICONS.users,
      title: "Social / Date",
      tip:   rain >= 40 ? "Pick an indoor venue — café or museum." : (wind >= 7 ? "Skip rooftop bars. Wind disrupts." : "Outdoor seating is a good pick.")
    },
    {
      icon:  ICONS.camera,
      title: "Photography",
      tip:   rain >= 40 ? "Rainy reflections are striking. Bring a clear umbrella." : (uv >= 6 ? "Golden hour (1 hr before sunset) for the best light." : "Good lighting — go shoot.")
    },
    {
      icon:  ICONS.droplet,
      title: "Hydration",
      tip:   f >= 28 || uv >= 7 ? "Drink 500 ml every 2 hours. Carry a bottle." : "Normal hydration. Aim for ~1.5 L during your outing."
    },
    {
      icon:  ICONS.shield,
      title: "Health",
      tip:   wind >= 7 ? "Wind kicks up pollen — mask up if sensitive." : (humid <= 30 ? "Dry air can irritate throat. Sip warm water." : "Normal conditions.")
    }
  ];
}
