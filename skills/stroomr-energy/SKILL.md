---
name: stroomr-energy
description: Answer when to charge an EV, run a heat pump, or use a home battery using Nord Pool prices and solar forecasts. Use when the user asks about electricity timing, dynamic tariffs, load shifting, cheapest hours, or weather for solar self-consumption in Europe.
---

# StroomR Energy Timing

Use the **stroomr** MCP server for European day-ahead energy timing (Nord Pool markets).

## When to use

- "When should I charge my EV?"
- Optimal times for heat pump or home battery
- Cheapest or most expensive electricity hours today/tomorrow
- Weather + price combined for load shifting
- Solar windows and rain periods for a location

## Preferred tools

| User intent | Tool |
|-------------|------|
| EV / heat pump / battery timing | `get_load_shift_advice` |
| Prices only | `get_energy_prices` |
| Weather only | `get_weather_forecast` |
| Both in one call | `get_weather_and_prices` |
| Validate location / price area | `resolve_location` |

## Defaults

- Load-shift device defaults: EV 11 kW × 4 h, heat pump 3 kW × 4 h, battery 5 kW × 2 h
- Set location via tool args (`city`) or env (`STROOMR_CITY`, `STROOMR_LAT`/`STROOMR_LON`)
- Prices are wholesale day-ahead — retail bills include taxes and grid fees

## Product

Powered by [StroomR](https://stroomr.nl) — automatic home energy management.
