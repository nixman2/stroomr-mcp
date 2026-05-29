export const NORDPOOL_AREAS = [
  "DK1", "DK2", "FI",
  "NO1", "NO2", "NO3", "NO4", "NO5",
  "SE1", "SE2", "SE3", "SE4",
  "EE", "LT", "LV",
  "AT", "BE", "FR", "GER", "NL", "PL",
  "BG", "TEL",
] as const;

export type NordPoolArea = (typeof NORDPOOL_AREAS)[number];

export const NORDPOOL_AREA_SET = new Set<string>(NORDPOOL_AREAS);

export const SUPPORTED_COUNTRY_CODES = new Set([
  "DK", "FI", "NO", "SE", "EE", "LT", "LV",
  "AT", "BE", "FR", "DE", "NL", "PL", "BG",
]);

export function isValidPriceArea(area: string): area is NordPoolArea {
  return NORDPOOL_AREA_SET.has(area);
}

export function normalizePriceAreaInput(area: string): string {
  const upper = area.trim().toUpperCase();
  if (upper === "DE" || upper === "DE-LU") return "GER";
  return upper;
}

export function inferPriceAreaFromCountry(
  countryCode: string,
  latitude: number,
  longitude: number,
): { area: NordPoolArea | null; note?: string } {
  const cc = countryCode.toUpperCase();

  switch (cc) {
    case "NL": return { area: "NL" };
    case "AT": return { area: "AT" };
    case "BE": return { area: "BE" };
    case "FR": return { area: "FR" };
    case "PL": return { area: "PL" };
    case "FI": return { area: "FI" };
    case "EE": return { area: "EE" };
    case "LT": return { area: "LT" };
    case "LV": return { area: "LV" };
    case "BG": return { area: "BG" };
    case "DE":
    case "LU":
      return { area: "GER" };
    case "DK": {
      const area = longitude < 10.5 ? "DK1" : "DK2";
      return { area, note: `Denmark inferred as ${area} from longitude` };
    }
    case "NO": {
      if (latitude >= 69) return { area: "NO4", note: "Norway inferred as NO4 (north)" };
      if (latitude >= 65) return { area: "NO3", note: "Norway inferred as NO3 (central-north)" };
      if (latitude >= 62) return { area: "NO2", note: "Norway inferred as NO2 (south-west)" };
      if (longitude >= 12) return { area: "NO1", note: "Norway inferred as NO1 (south-east)" };
      return { area: "NO5", note: "Norway inferred as NO5 (west)" };
    }
    case "SE": {
      if (latitude >= 65) return { area: "SE1", note: "Sweden inferred as SE1 (north)" };
      if (latitude >= 62) return { area: "SE2", note: "Sweden inferred as SE2 (north-central)" };
      if (latitude >= 59) return { area: "SE3", note: "Sweden inferred as SE3 (central)" };
      return { area: "SE4", note: "Sweden inferred as SE4 (south)" };
    }
    default:
      return { area: null };
  }
}

export function formatSupportedAreasList(): string {
  return NORDPOOL_AREAS.join(", ");
}
