# stroomr-mcp

MCP server for Electricity pricing and weather data including forecasts and optimal timing windows on when to Charge your EV or use your Home batteries stored energy.

Powered by StroomR — energy-advice for your AI ” + installation + example prompts stroomr.nl

Weather data from [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Energy prices from the Nord Pool public data portal API (community-documented, unofficial).

## Features

- `resolve_location` — geocode a city or validate coordinates + Nord Pool price area
- `get_weather_forecast` — sun hours, sun windows, rain periods, precipitation (NL-friendly summaries)
- `get_energy_prices` — current price, today/tomorrow Nord Pool day-ahead slots
- `get_weather_and_prices` — combined snapshot for load-shifting

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

If only `STROOMR_PRICE_AREA` is set, energy tools work but weather tools require a city or coordinates.

### Output format

| Value | Behaviour |
|-------|-----------|
| `friendly` (default) | NL summary text + JSON payload (good for chat) |
| `structured` | Single JSON envelope only — optimised for LLMs and code |

Aliases for structured mode: `json`, `machine`.

Example structured response:

```json
{
  "schema_version": "1.0",
  "format": "structured",
  "generated_at": "2026-05-30T14:00:00.000Z",
  "tool": "get_weather_forecast",
  "ok": true,
  "summary_nl": "Morgen ca. 15 uur zon...",
  "data": { }
}
```

Set in `.cursor/mcp.json`:

```json
"env": {
  "STROOMR_OUTPUT_FORMAT": "structured"
}
```

## Example prompts (Dutch)

| Prompt | Tool |
|--------|------|
| Huidige energieprijzen | `get_energy_prices` |
| Hoeveel zon schijnt er vandaag? | `get_weather_forecast` |
| Hoeveel regen valt er vandaag en wanneer? | `get_weather_forecast` |
| Welke tijden komt er vandaag zon? | `get_weather_forecast` → `sun_windows` |

## Smoke test

```bash
npm run build
node scripts/smoke-test.mjs
```

## Attribution

- Weather data by [Open-Meteo.com](https://open-meteo.com/)
- Day-ahead prices from [Nord Pool Group](https://www.nordpoolgroup.com/)

## Disclaimer

The Nord Pool data portal endpoint (`dataportal-api.nordpoolgroup.com`) is widely used in open-source projects but is not an officially documented public API. It may change without notice.
