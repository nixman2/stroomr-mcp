import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.js";
import { isValidPriceArea, normalizePriceAreaInput } from "../constants/nordpool-areas.js";
import { formatPriceEurPerKwh, formatToolResponse } from "../lib/format.js";
import { isLocationError, resolveLocation } from "../lib/location.js";
import {
  addDaysToDateString,
  buildDayPrices,
  fetchDayPrices,
  findCurrentAndNextPrice,
  formatDateInTimezone,
} from "../services/nordpool.js";
import type { EnergyPricesResult } from "../types/index.js";

const locationSchema = {
  city: z.string().optional().describe("Stad of plaats"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  price_area: z.string().optional().describe("Nord Pool prijsgebied, bijv. NL"),
};

export async function getEnergyPricesData(
  args: {
    city?: string;
    latitude?: number;
    longitude?: number;
    price_area?: string;
    days?: "today" | "tomorrow" | "both";
    resolution?: "hour" | "quarter";
    currency?: string;
  },
  config: AppConfig,
): Promise<EnergyPricesResult | { error: string }> {
  const locationResult = await resolveLocation(
    {
      city: args.city,
      latitude: args.latitude,
      longitude: args.longitude,
      priceArea: args.price_area,
    },
    config,
  );

  let priceArea: string | undefined;
  let timezone = config.timezone ?? "Europe/Amsterdam";

  if (isLocationError(locationResult)) {
    if (locationResult.energyOnly && locationResult.priceArea) {
      priceArea = locationResult.priceArea;
    } else {
      return { error: locationResult.message };
    }
  } else {
    timezone = config.timezone ?? locationResult.timezone;
    priceArea = locationResult.priceArea ?? undefined;
  }

  const explicitArea = args.price_area
    ? normalizePriceAreaInput(args.price_area)
    : undefined;

  if (explicitArea) {
    if (!isValidPriceArea(explicitArea)) {
      return { error: `Ongeldig prijsgebied '${args.price_area}'. Gebruik bijv. NL, GER, DK1.` };
    }
    priceArea = explicitArea;
  }

  if (!priceArea) {
    return {
      error:
        "Geen Nord Pool prijsgebied beschikbaar voor deze locatie. Geef price_area op of stel STROOMR_PRICE_AREA in.",
    };
  }

  const resolution = args.resolution ?? "quarter";
  const currency = args.currency ?? config.currency;
  const daysFilter = args.days ?? "both";

  const now = new Date();
  const todayDate = formatDateInTimezone(now, timezone);
  const tomorrowDate = addDaysToDateString(todayDate, 1);

  let todaySlots: EnergyPricesResult["today"]["slots"] = [];
  let tomorrowSlots: EnergyPricesResult["tomorrow"]["slots"] = [];
  let updatedAt: string | undefined;

  if (daysFilter === "today" || daysFilter === "both") {
    const todayData = await fetchDayPrices(priceArea, todayDate, resolution, currency);
    todaySlots = todayData.slots;
    updatedAt = todayData.updatedAt;
  }

  if (daysFilter === "tomorrow" || daysFilter === "both") {
    const tomorrowData = await fetchDayPrices(priceArea, tomorrowDate, resolution, currency);
    tomorrowSlots = tomorrowData.slots;
    updatedAt = updatedAt ?? tomorrowData.updatedAt;
  }

  const today = buildDayPrices(todayDate, "today", todaySlots);
  const tomorrow = buildDayPrices(tomorrowDate, "tomorrow", tomorrowSlots);

  const allTodaySlots = today.slots;
  const { current, next } = findCurrentAndNextPrice(allTodaySlots, now);

  return {
    priceArea,
    currency,
    resolution,
    timezone,
    currentPrice: current,
    nextPrice: next,
    today,
    tomorrow,
    tomorrowAvailable: tomorrow.available,
    updatedAt,
  };
}

export function registerEnergyTool(server: McpServer, config: AppConfig): void {
  server.registerTool(
    "get_energy_prices",
    {
      title: "Get Energy Prices",
      description:
        "Nord Pool day-ahead stroomprijzen voor vandaag en morgen. Huidige energieprijs (current_price), goedkoopste/duurste uren. Gebruik voor vragen over energieprijzen en stroomprijs.",
      inputSchema: z.object({
        ...locationSchema,
        days: z
          .enum(["today", "tomorrow", "both"])
          .optional()
          .describe("Welke dagen ophalen (default: both)"),
        resolution: z
          .enum(["hour", "quarter"])
          .optional()
          .describe("Resolutie: quarter (15 min) of hour (default: quarter)"),
        currency: z.string().optional().describe("Valuta (default: EUR)"),
      }),
    },
    async (args) => {
      try {
        const result = await getEnergyPricesData(args, config);

        if ("error" in result) {
          return formatToolResponse({
            config,
            tool: "get_energy_prices",
            ok: false,
            error: result.error,
            errorCode: "ENERGY_UNAVAILABLE",
            data: null,
          });
        }

        let summary = `Prijsgebied ${result.priceArea}. `;

        if (result.currentPrice) {
          summary += `Huidige prijs: ${formatPriceEurPerKwh(result.currentPrice.priceEurPerKwh)}. `;
        }

        if (result.nextPrice) {
          summary += `Volgende slot: ${formatPriceEurPerKwh(result.nextPrice.priceEurPerKwh)}. `;
        }

        summary += `Vandaag gem.: ${formatPriceEurPerKwh(result.today.avgEurPerKwh)}. `;

        if (result.tomorrowAvailable) {
          summary += `Morgen gem.: ${formatPriceEurPerKwh(result.tomorrow.avgEurPerKwh)}.`;
        } else {
          summary += "Morgenprijzen nog niet beschikbaar (meestal na ~13:00 CET).";
        }

        return formatToolResponse({
          config,
          tool: "get_energy_prices",
          ok: true,
          summaryNl: summary,
          data: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return formatToolResponse({
          config,
          tool: "get_energy_prices",
          ok: false,
          error: message,
          errorCode: "ENERGY_FETCH_FAILED",
          data: null,
        });
      }
    },
  );
}
