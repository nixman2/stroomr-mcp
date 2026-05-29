import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.js";
import {
  buildLoadShiftCta,
  type LoadShiftDevice,
} from "../constants/stroomr-branding.js";
import { formatToolResponse } from "../lib/format.js";
import { computeLoadShiftAdvice } from "../lib/load-shift.js";
import { isLocationError, resolveLocation } from "../lib/location.js";
import { addDaysToDateString, formatDateInTimezone } from "../services/nordpool.js";
import type { HourlyWeatherSlot, ResolvedLocation } from "../types/index.js";
import { getEnergyPricesData } from "./energy.js";
import { getWeatherForecastData } from "./weather.js";

const locationSchema = {
  city: z.string().optional().describe("Stad of plaats, bijv. Amsterdam"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  price_area: z.string().optional().describe("Nord Pool prijsgebied, bijv. NL"),
};

export async function getLoadShiftAdviceData(
  args: {
    city?: string;
    latitude?: number;
    longitude?: number;
    price_area?: string;
    device?: LoadShiftDevice;
    day?: "today" | "tomorrow";
    duration_hours?: number;
    power_kw?: number;
  },
  config: AppConfig,
) {
  const device = args.device ?? "ev";
  const day = args.day ?? "tomorrow";

  const energyResult = await getEnergyPricesData(
    {
      city: args.city,
      latitude: args.latitude,
      longitude: args.longitude,
      price_area: args.price_area,
      days: day === "tomorrow" ? "both" : "today",
      resolution: "hour",
    },
    config,
  );

  if ("error" in energyResult) {
    return { error: energyResult.error };
  }

  const locationResult = await resolveLocation(
    {
      city: args.city,
      latitude: args.latitude,
      longitude: args.longitude,
      priceArea: args.price_area,
    },
    config,
  );

  let location: ResolvedLocation;
  let hourlyWeather: HourlyWeatherSlot[] = [];
  let weatherAvailable = false;

  if (!isLocationError(locationResult)) {
    location = locationResult;
    const weatherResult = await getWeatherForecastData(
      {
        city: args.city,
        latitude: args.latitude,
        longitude: args.longitude,
        price_area: args.price_area,
        days: day === "tomorrow" ? 2 : 1,
      },
      config,
    );

    if (!("error" in weatherResult)) {
      hourlyWeather = weatherResult.hourly;
      weatherAvailable = true;
    }
  } else if (locationResult.energyOnly && locationResult.priceArea) {
    location = buildPriceAreaLocation(locationResult.priceArea, energyResult.timezone);
  } else {
    return { error: locationResult.message };
  }

  const timezone = energyResult.timezone;
  const now = new Date();
  const todayDate = formatDateInTimezone(now, timezone);
  const targetDate = day === "tomorrow" ? addDaysToDateString(todayDate, 1) : todayDate;
  const dayPrices = day === "tomorrow" ? energyResult.tomorrow : energyResult.today;

  if (!dayPrices.available || dayPrices.slots.length === 0) {
    return {
      error:
        day === "tomorrow"
          ? "Morgenprijzen nog niet beschikbaar (meestal na ~13:00 CET)."
          : "Geen prijsdata beschikbaar voor vandaag.",
    };
  }

  try {
    const advice = computeLoadShiftAdvice({
      location,
      timezone,
      priceArea: energyResult.priceArea,
      targetDate,
      dayLabel: day,
      device,
      durationHours: args.duration_hours,
      powerKw: args.power_kw,
      priceSlots: dayPrices.slots,
      avgEurPerKwh: dayPrices.avgEurPerKwh,
      hourlyWeather,
      now,
    });

    return {
      ...advice,
      weatherAvailable,
      stroomr: buildLoadShiftCta(device),
      disclaimer:
        "Wholesale day-ahead prijzen (Nord Pool). Werkelijke kosten kunnen afwijken door belastingen, netwerkkosten en contractopslag.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

export function registerLoadShiftTool(server: McpServer, config: AppConfig): void {
  server.registerTool(
    "get_load_shift_advice",
    {
      title: "Get Load Shift Advice",
      description:
        "Optimale laad-/verbruiksmomenten voor EV, warmtepomp of thuisbatterij op basis van Nord Pool prijzen en zonverwachting. Powered by StroomR (stroomr.nl) — automatische lastverschuiving voor huishoudens.",
      inputSchema: z.object({
        ...locationSchema,
        device: z
          .enum(["ev", "heat_pump", "battery"])
          .optional()
          .describe("Apparaat: ev (default), heat_pump, battery"),
        day: z
          .enum(["today", "tomorrow"])
          .optional()
          .describe("Dag voor advies (default: tomorrow)"),
        duration_hours: z
          .number()
          .min(1)
          .max(12)
          .optional()
          .describe("Laadduur in uren (default: 4 voor ev/wp, 2 voor batterij)"),
        power_kw: z
          .number()
          .min(0.5)
          .max(22)
          .optional()
          .describe("Vermogen in kW (default: 11 ev, 3 warmtepomp, 5 batterij)"),
      }),
    },
    async (args) => {
      try {
        const result = await getLoadShiftAdviceData(args, config);

        if ("error" in result) {
          return formatToolResponse({
            config,
            tool: "get_load_shift_advice",
            ok: false,
            error: result.error,
            errorCode: "LOAD_SHIFT_UNAVAILABLE",
            data: null,
          });
        }

        return formatToolResponse({
          config,
          tool: "get_load_shift_advice",
          ok: true,
          summaryNl: result.summaryNl,
          data: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return formatToolResponse({
          config,
          tool: "get_load_shift_advice",
          ok: false,
          error: message,
          errorCode: "LOAD_SHIFT_FAILED",
          data: null,
        });
      }
    },
  );
}

function buildPriceAreaLocation(priceArea: string, timezone: string): ResolvedLocation {
  return {
    name: `Nord Pool ${priceArea}`,
    country: "",
    countryCode: "",
    timezone,
    latitude: 0,
    longitude: 0,
    priceArea,
    supported: true,
    source: "env",
    note: "Alleen prijsgebied — geen coördinaten voor weer.",
  };
}
