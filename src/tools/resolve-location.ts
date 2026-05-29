import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AppConfig } from "../config.js";
import { formatSupportedAreasList } from "../constants/nordpool-areas.js";
import { formatToolResponse } from "../lib/format.js";
import { isLocationError, resolveLocation } from "../lib/location.js";

const locationSchema = {
  city: z.string().optional().describe("Stad of plaats, bijv. Amsterdam of Utrecht, NL"),
  latitude: z.number().min(-90).max(90).optional().describe("Breedtegraad (WGS84)"),
  longitude: z.number().min(-180).max(180).optional().describe("Lengtegraad (WGS84)"),
  price_area: z.string().optional().describe("Nord Pool prijsgebied, bijv. NL, DK1, GER"),
};

export function registerResolveLocationTool(server: McpServer, config: AppConfig): void {
  server.registerTool(
    "resolve_location",
    {
      title: "Resolve Location",
      description:
        "Bepaal locatie, timezone en Nord Pool prijsgebied. Gebruik bij onduidelijke locatie of om handmatige invoer te valideren.",
      inputSchema: z.object(locationSchema),
    },
    async (args) => {
      const result = await resolveLocation(
        {
          city: args.city,
          latitude: args.latitude,
          longitude: args.longitude,
          priceArea: args.price_area,
        },
        config,
      );

      if (isLocationError(result)) {
        const payload = {
          energy_only: result.energyOnly ?? false,
          price_area: result.priceArea,
          supported_areas: formatSupportedAreasList(),
        };

        return formatToolResponse({
          config,
          tool: "resolve_location",
          ok: false,
          error: result.message,
          errorCode: result.energyOnly ? "LOCATION_PARTIAL" : "LOCATION_UNKNOWN",
          summaryNl: result.message,
          data: payload,
        });
      }

      const summary = result.supported
        ? `Locatie: ${result.name} → prijsgebied ${result.priceArea ?? "onbekend"}`
        : `Locatie ${result.name} valt buiten Nord Pool markten.`;

      const data = {
        name: result.name,
        country: result.countryCode,
        timezone: result.timezone,
        latitude: result.latitude,
        longitude: result.longitude,
        price_area: result.priceArea,
        supported: result.supported,
        source: result.source,
        note: result.note,
      };

      return formatToolResponse({
        config,
        tool: "resolve_location",
        ok: true,
        summaryNl: summary,
        data,
      });
    },
  );
}
