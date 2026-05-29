export type OutputFormat = "friendly" | "structured";

export interface AppConfig {
  city?: string;
  latitude?: number;
  longitude?: number;
  priceArea?: string;
  currency: string;
  timezone?: string;
  outputFormat: OutputFormat;
}

export function loadConfig(): AppConfig {
  const lat = parseEnvNumber(process.env.STROOMR_LAT);
  const lon = parseEnvNumber(process.env.STROOMR_LON);

  return {
    city: process.env.STROOMR_CITY?.trim() || undefined,
    latitude: lat,
    longitude: lon,
    priceArea: process.env.STROOMR_PRICE_AREA?.trim().toUpperCase() || undefined,
    currency: process.env.STROOMR_CURRENCY?.trim().toUpperCase() || "EUR",
    timezone: process.env.STROOMR_TIMEZONE?.trim() || undefined,
    outputFormat: parseOutputFormat(process.env.STROOMR_OUTPUT_FORMAT),
  };
}

function parseOutputFormat(value: string | undefined): OutputFormat {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "structured" || normalized === "json" || normalized === "machine") {
    return "structured";
  }
  return "friendly";
}

function parseEnvNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
