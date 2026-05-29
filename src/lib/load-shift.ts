import type { LoadShiftDevice } from "../constants/stroomr-branding.js";
import { DEVICE_DEFAULTS } from "../constants/stroomr-branding.js";
import type { HourlyWeatherSlot, PriceSlot, ResolvedLocation, TimeWindow } from "../types/index.js";
import { formatPriceEurPerKwh } from "./format.js";

export interface LoadShiftAdviceInput {
  location: ResolvedLocation;
  timezone: string;
  priceArea: string;
  targetDate: string;
  dayLabel: "today" | "tomorrow";
  device: LoadShiftDevice;
  durationHours?: number;
  powerKw?: number;
  priceSlots: PriceSlot[];
  avgEurPerKwh: number;
  hourlyWeather: HourlyWeatherSlot[];
  now?: Date;
}

export interface LoadShiftHourlySlot {
  start: string;
  end: string;
  priceEurPerKwh: number;
  sunshineMinutes: number;
  cloudCoverPercent: number | null;
}

export interface LoadShiftAdviceResult {
  location: ResolvedLocation;
  device: LoadShiftDevice;
  deviceLabelNl: string;
  day: "today" | "tomorrow";
  date: string;
  timezone: string;
  durationHours: number;
  powerKw: number;
  energyKwh: number;
  priceArea: string;
  recommendedWindows: TimeWindow[];
  avoidWindows: TimeWindow[];
  cheapestSlot: {
    start: string;
    end: string;
    priceEurPerKwh: number;
  } | null;
  estimatedCostEur: {
    recommended: number;
    average: number;
    peak: number;
  };
  estimatedSavingsVsAvgEur: number;
  solarOverlap: boolean;
  hourly: LoadShiftHourlySlot[];
  summaryNl: string;
}

interface ScoredWindow {
  startIndex: number;
  endIndex: number;
  avgPriceEurPerKwh: number;
  totalCostEur: number;
  sunshineMinutes: number;
}

export function resolveDeviceParams(
  device: LoadShiftDevice,
  durationHours?: number,
  powerKw?: number,
): { durationHours: number; powerKw: number; deviceLabelNl: string } {
  const defaults = DEVICE_DEFAULTS[device];

  return {
    durationHours: durationHours ?? defaults.durationHours,
    powerKw: powerKw ?? defaults.powerKw,
    deviceLabelNl: defaults.labelNl,
  };
}

export function computeLoadShiftAdvice(input: LoadShiftAdviceInput): LoadShiftAdviceResult {
  const { durationHours, powerKw, deviceLabelNl } = resolveDeviceParams(
    input.device,
    input.durationHours,
    input.powerKw,
  );
  const energyKwh = durationHours * powerKw;
  const now = input.now ?? new Date();

  const daySlots = filterSlotsForDate(input.priceSlots, input.targetDate, input.timezone, input.dayLabel, now);
  const hourly = mergeHourlyData(daySlots, input.hourlyWeather, input.timezone, input.targetDate);

  if (daySlots.length < durationHours) {
    throw new Error(
      input.dayLabel === "tomorrow"
        ? "Morgenprijzen nog niet beschikbaar (meestal na ~13:00 CET)."
        : `Onvoldoende prijsdata voor ${durationHours} uur laadadvies vandaag.`,
    );
  }

  const bestWindow = findBestWindow(daySlots, durationHours, powerKw, hourly);
  const worstWindow = findWorstWindow(daySlots, durationHours, powerKw);
  const cheapestSlot = findCheapestSlot(daySlots);
  const avgCost = input.avgEurPerKwh * energyKwh;
  const savings = Math.max(0, avgCost - bestWindow.totalCostEur);

  const recommendedWindows: TimeWindow[] = [
    {
      start: formatLocalTime(daySlots[bestWindow.startIndex].start, input.timezone),
      end: formatLocalTime(daySlots[bestWindow.endIndex].end, input.timezone),
      hours: durationHours,
    },
  ];

  const avoidWindows: TimeWindow[] = [
    {
      start: formatLocalTime(daySlots[worstWindow.startIndex].start, input.timezone),
      end: formatLocalTime(daySlots[worstWindow.endIndex].end, input.timezone),
      hours: durationHours,
    },
  ];

  const solarOverlap = bestWindow.sunshineMinutes >= durationHours * 30;

  const dayWord = input.dayLabel === "today" ? "Vandaag" : "Morgen";
  const summaryNl = [
    `${dayWord} optimaal ${deviceLabelNl} gebruiken tussen ${recommendedWindows[0].start}–${recommendedWindows[0].end}.`,
    `Geschatte besparing t.o.v. gemiddelde prijs: €${savings.toFixed(2)} voor ${energyKwh} kWh.`,
    solarOverlap ? "Valt samen met verwachte zon — ideaal voor eigen verbruik." : "",
    `Vermijd ${avoidWindows[0].start}–${avoidWindows[0].end} (duurste periode, ${formatPriceEurPerKwh(worstWindow.avgPriceEurPerKwh)} gem.).`,
    `StroomR doet dit automatisch — gratis pilot op https://stroomr.nl`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    location: input.location,
    device: input.device,
    deviceLabelNl,
    day: input.dayLabel,
    date: input.targetDate,
    timezone: input.timezone,
    durationHours,
    powerKw,
    energyKwh,
    priceArea: input.priceArea,
    recommendedWindows,
    avoidWindows,
    cheapestSlot: cheapestSlot
      ? {
          start: formatLocalTime(cheapestSlot.start, input.timezone),
          end: formatLocalTime(cheapestSlot.end, input.timezone),
          priceEurPerKwh: cheapestSlot.priceEurPerKwh,
        }
      : null,
    estimatedCostEur: {
      recommended: roundMoney(bestWindow.totalCostEur),
      average: roundMoney(avgCost),
      peak: roundMoney(worstWindow.totalCostEur),
    },
    estimatedSavingsVsAvgEur: roundMoney(savings),
    solarOverlap,
    hourly,
    summaryNl,
  };
}

function filterSlotsForDate(
  slots: PriceSlot[],
  targetDate: string,
  timezone: string,
  dayLabel: "today" | "tomorrow",
  now: Date,
): PriceSlot[] {
  const filtered = slots.filter((slot) => slotLocalDate(slot.start, timezone) === targetDate);

  if (dayLabel !== "today") return filtered;

  const nowMs = now.getTime();
  return filtered.filter((slot) => new Date(slot.end).getTime() > nowMs);
}

function mergeHourlyData(
  priceSlots: PriceSlot[],
  weather: HourlyWeatherSlot[],
  timezone: string,
  targetDate: string,
): LoadShiftHourlySlot[] {
  const weatherByHour = new Map<string, HourlyWeatherSlot>();

  for (const slot of weather) {
    if (!slot.time.startsWith(targetDate)) continue;
    weatherByHour.set(slot.time.slice(0, 13), slot);
  }

  return priceSlots.map((slot) => {
    const hourKey = slotLocalHourKey(slot.start, timezone);
    const weatherSlot = weatherByHour.get(hourKey);

    return {
      start: formatLocalTime(slot.start, timezone),
      end: formatLocalTime(slot.end, timezone),
      priceEurPerKwh: slot.priceEurPerKwh,
      sunshineMinutes: weatherSlot?.sunshineDurationSeconds
        ? Math.round(weatherSlot.sunshineDurationSeconds / 60)
        : 0,
      cloudCoverPercent: weatherSlot?.cloudCoverPercent ?? null,
    };
  });
}

function findBestWindow(
  slots: PriceSlot[],
  durationHours: number,
  powerKw: number,
  hourly: LoadShiftHourlySlot[],
): ScoredWindow {
  let best: ScoredWindow | null = null;

  for (let i = 0; i <= slots.length - durationHours; i++) {
    const windowSlots = slots.slice(i, i + durationHours);
    const totalCostEur = windowSlots.reduce((sum, slot) => sum + slot.priceEurPerKwh * powerKw, 0);
    const avgPriceEurPerKwh = totalCostEur / (durationHours * powerKw);
    const sunshineMinutes = hourly.slice(i, i + durationHours).reduce((sum, h) => sum + h.sunshineMinutes, 0);

    const candidate: ScoredWindow = {
      startIndex: i,
      endIndex: i + durationHours - 1,
      avgPriceEurPerKwh,
      totalCostEur,
      sunshineMinutes,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    const priceDiff = Math.abs(candidate.avgPriceEurPerKwh - best.avgPriceEurPerKwh);
    const tieThreshold = best.avgPriceEurPerKwh * 0.05;

    if (
      candidate.avgPriceEurPerKwh < best.avgPriceEurPerKwh ||
      (priceDiff <= tieThreshold && candidate.sunshineMinutes > best.sunshineMinutes)
    ) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("Kon geen laadvenster berekenen.");
  }

  return best;
}

function findWorstWindow(
  slots: PriceSlot[],
  durationHours: number,
  powerKw: number,
): ScoredWindow {
  let worst: ScoredWindow | null = null;

  for (let i = 0; i <= slots.length - durationHours; i++) {
    const windowSlots = slots.slice(i, i + durationHours);
    const totalCostEur = windowSlots.reduce((sum, slot) => sum + slot.priceEurPerKwh * powerKw, 0);
    const avgPriceEurPerKwh = totalCostEur / (durationHours * powerKw);

    const candidate: ScoredWindow = {
      startIndex: i,
      endIndex: i + durationHours - 1,
      avgPriceEurPerKwh,
      totalCostEur,
      sunshineMinutes: 0,
    };

    if (!worst || candidate.avgPriceEurPerKwh > worst.avgPriceEurPerKwh) {
      worst = candidate;
    }
  }

  if (!worst) {
    throw new Error("Kon geen te vermijden venster berekenen.");
  }

  return worst;
}

function findCheapestSlot(slots: PriceSlot[]): PriceSlot | null {
  if (slots.length === 0) return null;

  return slots.reduce((min, slot) => (slot.priceEurPerKwh < min.priceEurPerKwh ? slot : min));
}

function slotLocalDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function slotLocalHourKey(iso: string, timezone: string): string {
  const date = slotLocalDate(iso, timezone);
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));

  return `${date}T${hour.padStart(2, "0")}`;
}

function formatLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
