# StroomR MCP

**Helps AI assistants answer “when should I use electricity?” in one call — with live Nord Pool prices, local solar forecasts, and ready-to-use load-shift advice.**

Built by [StroomR](https://stroomr.nl). Specialized for **European day-ahead energy markets** and **home energy timing** — not a general weather or finance API.

---

## What your agent can do

| Job | Without this server | With StroomR MCP |
|-----|---------------------|------------------|
| EV charging advice | Agent guesses or asks user to check multiple apps | One tool call → optimal window, savings estimate, hours to avoid |
| Heat pump / battery timing | Manual price lookup + weather check | Combined price + solar overlap in structured output |
| “Is tomorrow sunny?” + “Are prices low?” | Two separate lookups, agent merges context | Single combined snapshot for load-shifting decisions |

**Outcome, not plumbing:** your agent completes energy-timing tasks with fewer steps, pre-merged context, and structured fields (`recommendedWindows`, `avoidWindows`, `estimatedSavingsVsAvgEur`) instead of raw API dumps.

---

## Best use cases

1. **“When should I charge my EV tomorrow?”** — cheapest consecutive window, estimated savings vs. average, evening peak to avoid.
2. **“Optimal times for my heat pump today”** — price-ranked hours with solar overlap for self-consumption.
3. **“Will it be sunny tomorrow, and are electricity prices low?”** — weather + Nord Pool snapshot for solar/load decisions.
4. **“What are the cheapest hours to use power this week?”** — day-ahead slots for today and tomorrow.
5. **“How much sun will I get today?”** — sun hours, sun windows, and rain periods for a given location.

**Scope:** Nord Pool day-ahead markets in Europe (`NL`, `GER`, `DK1`, `SE3`, etc.). Not for real-time trading, grid operator data, or non-European utilities.

---

## Supported clients

Works with any MCP-compatible assistant, including:

- **Cursor** (local stdio — config included in this repo)
- **Claude Desktop** (add to `claude_desktop_config.json`)
- **Other MCP hosts** that support stdio servers (ChatGPT desktop integrations, custom agents, etc.)

Requires **Node.js 20+**. Runs locally on your machine — no StroomR account required to use the MCP.

---

## Auth & safety

| | |
|---|---|
| **Runs** | Locally via stdio (`node dist/index.js`) |
| **Credentials** | None — no API keys, no StroomR login |
| **Network** | Read-only outbound calls to Open-Meteo (weather) and Nord Pool public day-ahead API (prices) |
| **Writes** | None — does not control devices, meters, or your home |
| **Data sent** | Location (city or coordinates) and Nord Pool area — only what you pass in tool args or env config |

Set a default location in env so the agent does not need to ask every time:

```json
"env": {
  "STROOMR_CITY": "Amsterdam",
  "STROOMR_PRICE_AREA": "NL"
}
```

---

## Examples

### Example 1 — EV charging (primary use case)

**User prompt:**
> When should I charge my EV tomorrow?

**Agent action:** `get_load_shift_advice` · `{ "device": "ev", "day": "tomorrow" }`

**Agent reply (from structured output):**
> Charge between **10:00–14:00** tomorrow. Estimated savings: **€3.73** vs. average wholesale price for a 4 h session at 11 kW. Avoid **17:00–23:00** (evening peak). Overlaps with expected sunshine — good for solar self-consumption.

---

### Example 2 — Heat pump today

**User prompt:**
> Optimal times for heat pump today?

**Agent action:** `get_load_shift_advice` · `{ "device": "heat_pump", "day": "today" }`

**Agent reply:**
> Run intensive heating between **14:00–18:00** today (~€0.68 cheaper than average for 12 kWh). Avoid **19:00–23:00**.

---

### Example 3 — Weather + prices in one step

**User prompt:**
> Is tomorrow good for cheap charging and solar?

**Agent action:** `get_weather_and_prices` · `{ "days": 2 }`

**Agent reply:**
> Tomorrow: ~15 h sunshine (07:00–21:00), day-ahead prices near zero mid-day. Strong day for shifting loads to midday.

---

## Tools (5, purpose-built)

| Tool | Agent job |
|------|-----------|
| `get_load_shift_advice` | **Main tool.** Optimal + avoid windows for EV, heat pump, or battery; savings estimate; solar overlap |
| `get_weather_and_prices` | Combined snapshot when the agent needs both sun and price context |
| `get_energy_prices` | Cheapest/expensive hours, current and tomorrow Nord Pool day-ahead slots |
| `get_weather_forecast` | Sun windows, rain periods, precipitation — when solar matters |
| `resolve_location` | Validate city/coordinates and resolve Nord Pool price area |

**Defaults for load-shift advice:**

| Device | `device` | Power | Duration |
|--------|----------|-------|----------|
| EV charger | `ev` | 11 kW | 4 h |
| Heat pump | `heat_pump` | 3 kW | 4 h |
| Home battery | `battery` | 5 kW | 2 h |

Override with `power_kw` and `duration_hours`.

---

## Install

### From npm (after publish)

```json
{
  "mcpServers": {
    "stroomr": {
      "command": "npx",
      "args": ["-y", "@nixman2/stroomr-mcp"],
      "env": {
        "STROOMR_CITY": "Amsterdam",
        "STROOMR_PRICE_AREA": "NL"
      }
    }
  }
}
```

### From source

```bash
npm install
npm run build
```

### Cursor (local dev)

[`.cursor/mcp.json`](.cursor/mcp.json):

```json
{
  "mcpServers": {
    "stroomr": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "STROOMR_CITY": "Amsterdam",
        "STROOMR_PRICE_AREA": "NL",
        "STROOMR_OUTPUT_FORMAT": "structured"
      }
    }
  }
}
```

Restart Cursor after changing MCP config.

### Claude Desktop

```json
{
  "mcpServers": {
    "stroomr": {
      "command": "node",
      "args": ["/absolute/path/to/stroomr-mcp/dist/index.js"],
      "env": {
        "STROOMR_CITY": "Amsterdam",
        "STROOMR_PRICE_AREA": "NL"
      }
    }
  }
}
```

---

## Configuration

| Variable | Description |
|----------|-------------|
| `STROOMR_CITY` | Default city (geocoded) |
| `STROOMR_LAT` / `STROOMR_LON` | Default coordinates |
| `STROOMR_PRICE_AREA` | Nord Pool area (e.g. `NL`) |
| `STROOMR_CURRENCY` | Default `EUR` |
| `STROOMR_TIMEZONE` | Timezone override |
| `STROOMR_OUTPUT_FORMAT` | `friendly` (default) or `structured` |

**Priority:** tool arguments → env vars → clear error (no silent default city).

Structured responses include a `stroomr` branding block and fields optimised for agent parsing (`recommendedWindows`, `cheapestSlot`, `summary_nl`).

---

## Verify

```bash
npm run smoke-test
```

---

## About StroomR

This MCP is a **free demo** of the load-shifting logic in [StroomR](https://stroomr.nl) — energy management that automatically times EV charging, heat pumps, and batteries against dynamic tariffs and solar production.

**Want it to run 24/7 without asking an assistant?** [Join the free pilot →](https://stroomr.nl#aanmelden)

---

## Data sources & disclaimer

- Weather: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
- Prices: [Nord Pool Group](https://www.nordpoolgroup.com/) day-ahead via community-documented public API (unofficial; may change)

Load-shift advice uses **wholesale day-ahead** prices. Retail bills include taxes, grid fees, and supplier markups — savings estimates are indicative, not guaranteed.

**Supported Nord Pool areas:** `DK1`, `DK2`, `FI`, `NO1`–`NO5`, `SE1`–`SE4`, `EE`, `LT`, `LV`, `AT`, `BE`, `FR`, `GER`, `NL`, `PL`, `BG`, `TEL`

---

## Publish to MCP Registry

Prepared for the [official MCP Registry quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx):

| Step | Status |
|------|--------|
| 1. `mcpName` in `package.json` | ✅ `io.github.nixman2/stroomr-mcp` |
| 2. Publish to npm | ⏳ Run locally (requires npm login) |
| 3. Install `mcp-publisher` | ✅ |
| 4. Create `server.json` | ✅ Validated |
| 5. `mcp-publisher login github` | — |
| 6. `mcp-publisher publish` | — |

**Step 2 — publish to npm:**

```bash
npm adduser          # if not logged in
npm publish --access public
```

**Steps 5–6 — publish registry metadata:**

```bash
mcp-publisher login github
mcp-publisher publish
```

Verify listing:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nixman2/stroomr-mcp"
```

Registry name: **`io.github.nixman2/stroomr-mcp`** · npm: **`@nixman2/stroomr-mcp`**

---

## Submit to Cursor Directory

[cursor.directory](https://cursor.directory) scans the **repo root** for [Open Plugins](https://open-plugins.com) components. This repo includes:

| Path | Purpose |
|------|---------|
| `mcp.json` | MCP server config (required for directory scan) |
| `.cursor-plugin/plugin.json` | Plugin manifest |
| `skills/stroomr-energy/SKILL.md` | Agent skill for energy-timing questions |

After pushing to GitHub, re-scan at **Submit a Plugin → Auto (GitHub)** with `https://github.com/nixman2/stroomr-mcp`.

**Note:** `mcp.json` uses `npx @nixman2/stroomr-mcp` — npm publish must succeed first. Local dev still uses `.cursor/mcp.json`.
