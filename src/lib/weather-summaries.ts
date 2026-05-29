import type {
  DailyWeatherSummary,
  HourlyWeatherSlot,
  RainPeriod,
  TimeWindow,
} from "../types/index.js";
import type { OpenMeteoForecastResponse } from "../services/open-meteo.js";

const PRECIPITATION_THRESHOLD_MM = 0.1;

export function parseHourlyWeather(data: OpenMeteoForecastResponse): HourlyWeatherSlot[] {
  const { hourly } = data;
  return hourly.time.map((time, i) => ({
    time,
    temperatureC: hourly.temperature_2m?.[i] ?? null,
    precipitationMm: hourly.precipitation?.[i] ?? null,
    rainMm: hourly.rain?.[i] ?? null,
    cloudCoverPercent: hourly.cloud_cover?.[i] ?? null,
    shortwaveRadiation: hourly.shortwave_radiation?.[i] ?? null,
    sunshineDurationSeconds: hourly.sunshine_duration?.[i] ?? null,
    weatherCode: hourly.weather_code?.[i] ?? null,
  }));
}

export function buildDailySummaries(
  data: OpenMeteoForecastResponse,
  hourly: HourlyWeatherSlot[],
  timezone: string,
  days: number,
): DailyWeatherSummary[] {
  const summaries: DailyWeatherSummary[] = [];
  const todayStr = formatLocalDate(new Date(), timezone);

  for (let i = 0; i < Math.min(days, data.daily.time.length); i++) {
    const date = data.daily.time[i];
    const dayHourly = hourly.filter((h) => h.time.startsWith(date));

    const sunshineSecondsFromDaily = data.daily.sunshine_duration?.[i] ?? null;
    const sunshineFromHourly = dayHourly.reduce(
      (acc, h) => acc + (h.sunshineDurationSeconds ?? 0),
      0,
    );
    const sunshineTotalHours = round1(
      (sunshineSecondsFromDaily ?? sunshineFromHourly) / 3600,
    );

    const precipitationTotalMm = round1(
      data.daily.precipitation_sum?.[i] ??
        dayHourly.reduce((acc, h) => acc + (h.precipitationMm ?? 0), 0),
    );

    const sunWindows = computeSunWindows(dayHourly, timezone);
    const rainPeriods = computeRainPeriods(dayHourly, timezone);

    let label: DailyWeatherSummary["label"] = "day";
    if (date === todayStr) label = "today";
    else if (date === addDays(todayStr, 1)) label = "tomorrow";

    const summary: DailyWeatherSummary = {
      date,
      label,
      sunshineTotalHours,
      precipitationTotalMm,
      precipitationHours: data.daily.precipitation_hours?.[i] ?? rainPeriods.length,
      sunrise: data.daily.sunrise?.[i] ?? null,
      sunset: data.daily.sunset?.[i] ?? null,
      sunWindows,
      rainPeriods,
      minTempC: data.daily.temperature_2m_min?.[i] ?? null,
      maxTempC: data.daily.temperature_2m_max?.[i] ?? null,
      summaryNl: buildNlSummary(label, sunshineTotalHours, sunWindows, precipitationTotalMm, rainPeriods),
    };

    summaries.push(summary);
  }

  return summaries;
}

function computeSunWindows(hourly: HourlyWeatherSlot[], timezone: string): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let current: { start: string; end: string; hours: number } | null = null;

  for (const slot of hourly) {
    const hasSun = (slot.sunshineDurationSeconds ?? 0) > 0;
    const timeLabel = formatLocalTime(slot.time, timezone);

    if (hasSun) {
      if (!current) {
        current = { start: timeLabel, end: timeLabel, hours: 1 };
      } else {
        current.end = timeLabel;
        current.hours += 1;
      }
    } else if (current) {
      windows.push({ ...current });
      current = null;
    }
  }

  if (current) windows.push(current);
  return windows;
}

function computeRainPeriods(hourly: HourlyWeatherSlot[], timezone: string): RainPeriod[] {
  const periods: RainPeriod[] = [];
  let current: { start: string; end: string; totalMm: number } | null = null;

  for (const slot of hourly) {
    const precip = slot.precipitationMm ?? 0;
    const hasRain = precip >= PRECIPITATION_THRESHOLD_MM;
    const timeLabel = formatLocalTime(slot.time, timezone);

    if (hasRain) {
      if (!current) {
        current = { start: timeLabel, end: timeLabel, totalMm: precip };
      } else {
        current.end = timeLabel;
        current.totalMm += precip;
      }
    } else if (current) {
      periods.push({ ...current, totalMm: round1(current.totalMm) });
      current = null;
    }
  }

  if (current) periods.push({ ...current, totalMm: round1(current.totalMm) });
  return periods;
}

function buildNlSummary(
  label: DailyWeatherSummary["label"],
  sunshineHours: number,
  sunWindows: TimeWindow[],
  precipitationMm: number,
  rainPeriods: RainPeriod[],
): string {
  const dayLabel = label === "today" ? "Vandaag" : label === "tomorrow" ? "Morgen" : "Deze dag";
  const parts: string[] = [];

  parts.push(`${dayLabel} ca. ${sunshineHours} uur zon`);

  if (sunWindows.length > 0) {
    const windowText = sunWindows
      .map((w) => `${w.start}–${w.end}`)
      .join(", ");
    parts.push(`zon tussen ${windowText}`);
  } else if (sunshineHours === 0) {
    parts.push("geen zon verwacht");
  }

  if (precipitationMm > 0) {
    parts.push(`totaal ${precipitationMm} mm regen`);
    if (rainPeriods.length > 0) {
      const rainText = rainPeriods
        .map((p) => `${p.start}–${p.end} (${p.totalMm} mm)`)
        .join(", ");
      parts.push(`regen tussen ${rainText}`);
    }
  } else {
    parts.push("geen neerslag verwacht");
  }

  return parts.join(". ") + ".";
}

export function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatLocalTime(isoTime: string, timezone: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoTime));
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
