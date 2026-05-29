import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.js";
import { formatPriceEurPerKwh, formatToolResponse } from "../lib/format.js";
import { getEnergyPricesData } from "./energy.js";
import { getWeatherForecastData } from "./weather.js";

const locationSchema = {
  city: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  price_area: z.string().optional(),
};

export function registerCombinedTool(server: McpServer, config: AppConfig): void {
  server.registerTool(
    "get_weather_and_prices",
    {
      title: "Get Weather and Prices",
      description:
        "Gecombineerd overzicht van weer (zon, regen) en Nord Pool stroomprijzen. Handig voor load-shifting: wanneer goedkoop laden en veel zon verwacht.",
      inputSchema: z.object({
        ...locationSchema,
        days: z.number().int().min(1).max(7).optional(),
        resolution: z.enum(["hour", "quarter"]).optional(),
      }),
    },
    async (args) => {
      try {
        const [weatherResult, energyResult] = await Promise.all([
          getWeatherForecastData(
            {
              city: args.city,
              latitude: args.latitude,
              longitude: args.longitude,
              price_area: args.price_area,
              days: args.days ?? 2,
            },
            config,
          ),
          getEnergyPricesData(
            {
              city: args.city,
              latitude: args.latitude,
              longitude: args.longitude,
              price_area: args.price_area,
              days: "both",
              resolution: args.resolution,
            },
            config,
          ),
        ]);

        if ("error" in weatherResult) {
          return formatToolResponse({
            config,
            tool: "get_weather_and_prices",
            ok: false,
            error: weatherResult.error,
            errorCode: "WEATHER_UNAVAILABLE",
            data: null,
          });
        }

        if ("error" in energyResult) {
          return formatToolResponse({
            config,
            tool: "get_weather_and_prices",
            ok: false,
            error: energyResult.error,
            errorCode: "ENERGY_UNAVAILABLE",
            data: null,
          });
        }

        const todayWeather = weatherResult.daily.find((d) => d.label === "today");
        const cheapestSlots = [...energyResult.today.slots]
          .sort((a, b) => a.priceEurPerKwh - b.priceEurPerKwh)
          .slice(0, 4);

        const summary = [
          todayWeather?.summaryNl ?? "",
          energyResult.currentPrice
            ? `Huidige stroomprijs: ${formatPriceEurPerKwh(energyResult.currentPrice.priceEurPerKwh)}`
            : "",
          cheapestSlots.length > 0
            ? `Goedkoopste slots vandaag: ${cheapestSlots.map((s) => formatPriceEurPerKwh(s.priceEurPerKwh)).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const data = {
          location: weatherResult.location,
          weather: {
            daily: weatherResult.daily,
            timezone: weatherResult.timezone,
          },
          energy: {
            price_area: energyResult.priceArea,
            current_price: energyResult.currentPrice,
            next_price: energyResult.nextPrice,
            today: {
              min_eur_per_kwh: energyResult.today.minEurPerKwh,
              max_eur_per_kwh: energyResult.today.maxEurPerKwh,
              avg_eur_per_kwh: energyResult.today.avgEurPerKwh,
            },
            tomorrow_available: energyResult.tomorrowAvailable,
          },
        };

        return formatToolResponse({
          config,
          tool: "get_weather_and_prices",
          ok: true,
          summaryNl: summary,
          data,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return formatToolResponse({
          config,
          tool: "get_weather_and_prices",
          ok: false,
          error: message,
          errorCode: "COMBINED_FETCH_FAILED",
          data: null,
        });
      }
    },
  );
}
