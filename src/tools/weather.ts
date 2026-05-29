import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.js";
import { formatToolResponse } from "../lib/format.js";
import { isLocationError, resolveLocation } from "../lib/location.js";
import { buildDailySummaries, parseHourlyWeather } from "../lib/weather-summaries.js";
import { fetchForecast } from "../services/open-meteo.js";
import type { WeatherForecastResult } from "../types/index.js";

const locationSchema = {
  city: z.string().optional().describe("Stad of plaats, bijv. Amsterdam"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  price_area: z.string().optional(),
};

export async function getWeatherForecastData(
  args: {
    city?: string;
    latitude?: number;
    longitude?: number;
    price_area?: string;
    days?: number;
  },
  config: AppConfig,
): Promise<WeatherForecastResult | { error: string }> {
  const locationResult = await resolveLocation(
    {
      city: args.city,
      latitude: args.latitude,
      longitude: args.longitude,
      priceArea: args.price_area,
    },
    config,
  );

  if (isLocationError(locationResult)) {
    if (locationResult.energyOnly) {
      return {
        error:
          "Weer vereist coördinaten of een stad. Alleen STROOMR_PRICE_AREA is ingesteld — dat werkt voor energieprijzen, niet voor weer.",
      };
    }
    return { error: locationResult.message };
  }

  const days = Math.min(Math.max(args.days ?? 2, 1), 7);
  const timezone = config.timezone ?? locationResult.timezone;

  const forecast = await fetchForecast(
    locationResult.latitude,
    locationResult.longitude,
    days,
    timezone,
  );

  const hourly = parseHourlyWeather(forecast);
  const daily = buildDailySummaries(forecast, hourly, timezone, days);

  return {
    location: { ...locationResult, timezone },
    timezone,
    hourly,
    daily,
  };
}

export function registerWeatherTool(server: McpServer, config: AppConfig): void {
  server.registerTool(
    "get_weather_forecast",
    {
      title: "Get Weather Forecast",
      description:
        "Lokaal weer voor vandaag en komende dagen: zon, zonuren, zonperiodes (sun_windows), regen, neerslagtijden (rain_periods). Gebruik voor vragen over zon, regen en neerslag.",
      inputSchema: z.object({
        ...locationSchema,
        days: z
          .number()
          .int()
          .min(1)
          .max(7)
          .optional()
          .describe("Aantal dagen vooruit (default 2 = vandaag + morgen)"),
      }),
    },
    async (args) => {
      try {
        const result = await getWeatherForecastData(args, config);

        if ("error" in result) {
          return formatToolResponse({
            config,
            tool: "get_weather_forecast",
            ok: false,
            error: result.error,
            errorCode: "WEATHER_UNAVAILABLE",
            data: null,
          });
        }

        const summary = result.daily.map((d) => d.summaryNl).join("\n");
        return formatToolResponse({
          config,
          tool: "get_weather_forecast",
          ok: true,
          summaryNl: summary,
          data: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return formatToolResponse({
          config,
          tool: "get_weather_forecast",
          ok: false,
          error: message,
          errorCode: "WEATHER_FETCH_FAILED",
          data: null,
        });
      }
    },
  );
}
