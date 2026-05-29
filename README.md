# stroomr-mcp

Stroomr helps AI assistants find the best times to use electricity by combining local weather and dynamic energy prices. — when to charge your EV, run your heat pump, or use home battery storage.

Powered by [StroomR](https://stroomr.nl) — automatic energy management for households. This MCP is a free demo of StroomR's load-shifting logic inside your AI assistant.

Weather data from [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Energy prices from the Nord Pool public data portal API (community-documented, unofficial).

## Features

| Tool | Description |
|------|-------------|
| `resolve_location` | Geocode a city or validate coordinates and Nord Pool price area |
| `get_weather_forecast` | Sun hours, sun windows, rain periods, and precipitation summaries |
| `get_energy_prices` | Current price and today/tomorrow Nord Pool day-ahead slots |
| `get_weather_and_prices` | Combined weather + price snapshot for load-shifting |
| `get_load_shift_advice` | Optimal times to charge an EV, run a heat pump, or use a home battery — based on prices and solar forecast |

### Load-shift advice defaults

| Device | `device` value | Default power | Default duration |
|--------|----------------|---------------|----------------|
| EV charger | `ev` | 11 kW | 4 hours |
| Heat pump | `heat_pump` | 3 kW | 4 hours |
| Home battery | `battery` | 5 kW | 2 hours |

Override with `power_kw` and `duration_hours`. Set `day` to `today` or `tomorrow` (default: `tomorrow`).

## Supported Nord Pool areas

`DK1`, `DK2`, `FI`, `NO1`–`NO5`, `SE1`–`SE4`, `EE`, `LT`, `LV`, `AT`, `BE`, `FR`, `GER`, `NL`, `PL`, `BG`, `TEL`

Locations outside these markets receive a clear error with supported areas listed.

## Setup

```bash
npm install
npm run build
```

### Cursor

The repo includes [`.cursor/mcp.json`](.cursor/mcp.json):

```json
{
  "mcpServers": {
    "stroomr": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "STROOMR_CITY": "Amsterdam",
        "STROOMR_PRICE_AREA": "NL"
      }
    }
  }
}
```

Restart Cursor after changing MCP config.

## Configuration

| Variable | Description |
|----------|-------------|
| `STROOMR_CITY` | Default city (geocoded via Open-Meteo) |
| `STROOMR_LAT` / `STROOMR_LON` | Default coordinates |
| `STROOMR_PRICE_AREA` | Nord Pool area override (e.g. `NL`) |
| `STROOMR_CURRENCY` | Price currency (default `EUR`) |
| `STROOMR_TIMEZONE` | Timezone override |
| `STROOMR_OUTPUT_FORMAT` | Response format: `friendly` (default) or `structured` |

**Priority:** tool arguments → env vars → clear error (no silent default city).

If only `STROOMR_PRICE_AREA` is set, energy and load-shift tools work; weather tools require a city or coordinates.

### Output format

| Value | Behaviour |
|-------|-----------|
| `friendly` (default) | Summary text + JSON payload (good for chat) |
| `structured` | Single JSON envelope only — optimised for LLMs and code |

Aliases for structured mode: `json`, `machine`.

Set in `.cursor/mcp.json`:

```json
"env": {
  "STROOMR_OUTPUT_FORMAT": "structured"
}
```

## Example prompts

### Energy prices

| Prompt | Tool |
|--------|------|
| What are the current electricity prices? | `get_energy_prices` |
| Cheapest hours to use power today | `get_energy_prices` |
| Tomorrow's energy prices in the Netherlands | `get_energy_prices` |

### Weather

| Prompt | Tool |
|--------|------|
| Will it be sunny tomorrow? | `get_weather_forecast` |
| How much sun today? | `get_weather_forecast` |
| How much rain today and when? | `get_weather_forecast` |
| When is there sun today? | `get_weather_forecast` → `sun_windows` |

### Load shifting (StroomR)

| Prompt | Tool |
|--------|------|
| When should I charge my EV tomorrow? | `get_load_shift_advice` |
| Optimal times for heat pump today | `get_load_shift_advice` |
| Best window to charge my home battery tomorrow | `get_load_shift_advice` |
| When to avoid using power this evening? | `get_load_shift_advice` → `avoidWindows` |
| How much can I save by charging at the cheapest time? | `get_load_shift_advice` → `estimatedSavingsVsAvgEur` |

### Combined

| Prompt | Tool |
|--------|------|
| Weather and electricity prices for load shifting | `get_weather_and_prices` |
| Is tomorrow good for solar self-consumption and cheap charging? | `get_weather_and_prices` |

### Location

| Prompt | Tool |
|--------|------|
| What Nord Pool price area is Amsterdam in? | `resolve_location` |
| Validate coordinates for energy pricing | `resolve_location` |

## Smoke test

```bash
npm run smoke-test
```

## StroomR

This MCP demonstrates a slice of what [StroomR](https://stroomr.nl) does automatically:

- Shift EV charging, heat pumps, and batteries to the cheapest hours
- Combine dynamic tariffs with solar forecasts
- Run 24/7 without manual planning

**Free pilot:** [stroomr.nl#aanmelden](https://stroomr.nl#aanmelden)

## Attribution

- Weather data by [Open-Meteo.com](https://open-meteo.com/)
- Day-ahead prices from [Nord Pool Group](https://www.nordpoolgroup.com/)

## Disclaimer

The Nord Pool data portal endpoint (`dataportal-api.nordpoolgroup.com`) is widely used in open-source projects but is not an officially documented public API. It may change without notice.

Load-shift advice uses wholesale day-ahead prices. Actual costs may differ due to taxes, grid fees, and supplier markups.
