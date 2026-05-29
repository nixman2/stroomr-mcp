#!/usr/bin/env node
/**
 * Smoke test for stroomr-mcp core logic (no MCP stdio).
 * Run after: npm run build
 */
import { loadConfig } from "../dist/config.js";
import { getEnergyPricesData } from "../dist/tools/energy.js";
import { getLoadShiftAdviceData } from "../dist/tools/load-shift.js";
import { getWeatherForecastData } from "../dist/tools/weather.js";
import { isLocationError, resolveLocation } from "../dist/lib/location.js";

const config = loadConfig();

async function main() {
  console.log("=== resolve_location: Amsterdam ===");
  const amsterdam = await resolveLocation({ city: "Amsterdam" }, config);
  if (isLocationError(amsterdam)) {
    console.error("FAIL:", amsterdam.message);
    process.exit(1);
  }
  console.log(`OK: ${amsterdam.name} → ${amsterdam.priceArea} (supported: ${amsterdam.supported})`);

  console.log("\n=== resolve_location: New York (unsupported) ===");
  const ny = await resolveLocation({ city: "New York" }, config);
  if (isLocationError(ny)) {
    console.log("OK: unsupported location handled:", ny.message.slice(0, 80) + "...");
  } else {
    console.log(`Note: ${ny.name} → price_area=${ny.priceArea}, supported=${ny.supported}`);
  }

  console.log("\n=== get_energy_prices: NL ===");
  const prices = await getEnergyPricesData({ price_area: "NL", days: "both" }, config);
  if ("error" in prices) {
    console.error("FAIL:", prices.error);
    process.exit(1);
  }
  console.log(
    `OK: ${prices.today.slots.length} slots today, tomorrow available: ${prices.tomorrowAvailable}`,
  );
  if (prices.currentPrice) {
    console.log(`Current price: ${(prices.currentPrice.priceEurPerKwh * 100).toFixed(2)} ct/kWh`);
  }

  console.log("\n=== get_weather_forecast: Amsterdam ===");
  const weather = await getWeatherForecastData({ city: "Amsterdam", days: 2 }, config);
  if ("error" in weather) {
    console.error("FAIL:", weather.error);
    process.exit(1);
  }
  for (const day of weather.daily) {
    console.log(`OK [${day.label}]: ${day.summaryNl}`);
    console.log(`  sun_windows: ${day.sunWindows.length}, rain_periods: ${day.rainPeriods.length}`);
  }

  console.log("\n=== get_load_shift_advice: EV tomorrow, Amsterdam ===");
  const loadShift = await getLoadShiftAdviceData(
    { city: "Amsterdam", device: "ev", day: "tomorrow" },
    config,
  );
  if ("error" in loadShift) {
    console.log(`Note: load shift — ${loadShift.error}`);
  } else {
    const window = loadShift.recommendedWindows[0];
    console.log(`OK: ${loadShift.summaryNl.slice(0, 100)}...`);
    console.log(
      `  recommended: ${window.start}–${window.end}, savings: €${loadShift.estimatedSavingsVsAvgEur}`,
    );
  }

  console.log("\n=== missing location error ===");
  const missing = await resolveLocation({}, { city: undefined, latitude: undefined, longitude: undefined, currency: "EUR" });
  if (isLocationError(missing)) {
    console.log("OK: missing location returns helpful error");
  } else {
    console.error("FAIL: expected location error");
    process.exit(1);
  }

  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
