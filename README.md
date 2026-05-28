# Outing Planner

A single-page weather app that helps you decide what to wear and plan outdoor activities based on real-time hourly forecasts.

## What It Does

- Fetches live hourly weather data for any city (powered by [Open-Meteo](https://open-meteo.com/) — no API key required)
- Lets you select a time window for your outing using a slider (up to 48 hours ahead)
- Surfaces the conditions that matter most: temperature, feels-like, rain probability, wind, UV index, and humidity
- Generates outfit recommendations and activity tips based on the selected window
- Dynamically changes the background gradient based on weather condition and time of day

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no build step, no framework
- [Chart.js](https://www.chartjs.org/) for interactive charts
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) for city lookup
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) for hourly weather data

## How to Run

No installation needed. Open `index.html` directly in any modern browser:

```bash
open index.html
```

Or serve it with any static file server:

```bash
npx serve .
# → http://localhost:3000
```

## Design Decisions

**Bento grid layout** — The UI is split into a two-column bento grid: search controls alongside a live weather overview, then charts in paired rows. This gives recruiters and users a full-picture view without excessive scrolling.

**Glassmorphism on a dynamic background** — Cards use `backdrop-filter: blur(20px)` on a gradient that shifts between four states (sunny, cloudy, rainy, night) based on the current weather code and local hour. This keeps the UI visually informative without requiring icons or extra UI elements.

**No API key** — Open-Meteo is a free, open-source weather API. The app works immediately for any reviewer who opens the file, with no setup or credentials needed.

**Correct time alignment** — The hourly data array from Open-Meteo starts at midnight. The slider's zero point is mapped to the current local hour via `Array.findIndex`, so all temperature and weather values reflect actual current and future conditions, not midnight readings.

## Project Structure

```
weather-outfit/
├── index.html      # Entire app — markup, styles, and logic
└── .gitignore
```
