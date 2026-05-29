import type { GeocodingResult } from "../types/index.js";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export async function geocodeCity(name: string): Promise<GeocodingResult[]> {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "nl");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { results?: GeocodingResult[] };
  return data.results ?? [];
}

export interface OpenMeteoForecastResponse {
  timezone: string;
  hourly: {
    time: string[];
    temperature_2m?: (number | null)[];
    precipitation?: (number | null)[];
    rain?: (number | null)[];
    cloud_cover?: (number | null)[];
    shortwave_radiation?: (number | null)[];
    sunshine_duration?: (number | null)[];
    weather_code?: (number | null)[];
  };
  daily: {
    time: string[];
    sunshine_duration?: (number | null)[];
    precipitation_sum?: (number | null)[];
    precipitation_hours?: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
  };
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  forecastDays: number,
  timezone: string,
): Promise<OpenMeteoForecastResponse> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("forecast_days", String(forecastDays));
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation",
      "rain",
      "cloud_cover",
      "shortwave_radiation",
      "sunshine_duration",
      "weather_code",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    [
      "sunshine_duration",
      "precipitation_sum",
      "precipitation_hours",
      "sunrise",
      "sunset",
      "temperature_2m_max",
      "temperature_2m_min",
    ].join(","),
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OpenMeteoForecastResponse;
}
