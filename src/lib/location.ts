import type { AppConfig } from "../config.js";
import {
  formatSupportedAreasList,
  inferPriceAreaFromCountry,
  isValidPriceArea,
  normalizePriceAreaInput,
  SUPPORTED_COUNTRY_CODES,
} from "../constants/nordpool-areas.js";
import { geocodeCity } from "../services/open-meteo.js";
import type { LocationError, LocationInput, ResolvedLocation } from "../types/index.js";

export async function resolveLocation(
  input: LocationInput,
  config: AppConfig,
): Promise<ResolvedLocation | LocationError> {
  const city = input.city ?? config.city;
  const latitude = input.latitude ?? config.latitude;
  const longitude = input.longitude ?? config.longitude;
  const priceAreaOverride = input.priceArea
    ? normalizePriceAreaInput(input.priceArea)
    : config.priceArea;

  if (latitude != null && longitude != null) {
    return resolveFromCoordinates(
      latitude,
      longitude,
      city ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      priceAreaOverride,
      input.latitude != null ? "tool_arg" : "env",
    );
  }

  if (city) {
    const results = await geocodeCity(city);
    if (results.length === 0) {
      return {
        error: true,
        message:
          `Geen resultaat voor '${city}'. Probeer een andere spelling, voeg land toe ('${city}, NL'), of geef latitude/longitude op.`,
      };
    }

    const best = results[0];
    const displayName = best.admin1
      ? `${best.name}, ${best.admin1}, ${best.country}`
      : `${best.name}, ${best.country}`;

    return resolveFromCoordinates(
      best.latitude,
      best.longitude,
      displayName,
      priceAreaOverride,
      input.city ? "tool_arg" : "env",
      best.country_code,
      best.timezone,
    );
  }

  if (priceAreaOverride && isValidPriceArea(priceAreaOverride)) {
    return {
      error: true,
      message: buildMissingLocationMessage(),
      energyOnly: true,
      priceArea: priceAreaOverride,
    };
  }

  return {
    error: true,
    message: buildMissingLocationMessage(),
  };
}

function resolveFromCoordinates(
  latitude: number,
  longitude: number,
  name: string,
  priceAreaOverride: string | undefined,
  source: ResolvedLocation["source"],
  countryCode?: string,
  timezone?: string,
): ResolvedLocation {
  const cc = (countryCode ?? "").toUpperCase();
  const inferred = inferPriceAreaFromCountry(cc, latitude, longitude);

  let priceArea: string | null = null;
  let note = inferred.note;

  if (priceAreaOverride) {
    const normalized = normalizePriceAreaInput(priceAreaOverride);
    if (isValidPriceArea(normalized)) {
      priceArea = normalized;
      note = `Price area overridden to ${normalized}`;
    } else {
      note = `Invalid price area '${priceAreaOverride}'. Supported: ${formatSupportedAreasList()}`;
    }
  } else {
    priceArea = inferred.area;
  }

  const supported = priceArea != null && SUPPORTED_COUNTRY_CODES.has(cc);

  return {
    name,
    country: cc,
    countryCode: cc,
    timezone: timezone ?? "Europe/Amsterdam",
    latitude,
    longitude,
    priceArea,
    supported: supported || priceArea != null,
    source,
    note: !priceArea && cc
      ? `Location ${name} is outside Nord Pool day-ahead markets. Supported areas: ${formatSupportedAreasList()}. Configure STROOMR_PRICE_AREA for a nearby zone.`
      : note,
  };
}

export function buildMissingLocationMessage(): string {
  return [
    "Locatie onbekend. Geef een van de volgende op:",
    '- Stad: city: "Amsterdam"',
    "- Coördinaten: latitude + longitude",
    "- Config: zet STROOMR_CITY of STROOMR_LAT/STROOMR_LON in .cursor/mcp.json",
    "",
    "Alleen energieprijzen? Stel STROOMR_PRICE_AREA=NL in (of geef price_area mee).",
  ].join("\n");
}

export function isLocationError(
  result: ResolvedLocation | LocationError,
): result is LocationError {
  return "error" in result && result.error === true;
}
