import type { DayPrices, PriceSlot } from "../types/index.js";

const API_URL = "https://dataportal-api.nordpoolgroup.com/api/DayAheadPriceIndices";

interface NordPoolEntry {
  deliveryStart: string;
  deliveryEnd: string;
  entryPerArea?: Record<string, number | null>;
}

interface NordPoolResponse {
  updatedAt?: string;
  currency?: string;
  multiIndexEntries?: NordPoolEntry[];
}

export async function fetchDayPrices(
  priceArea: string,
  date: string,
  resolution: "hour" | "quarter",
  currency: string,
): Promise<{ slots: PriceSlot[]; updatedAt?: string; currency: string }> {
  const url = new URL(API_URL);
  url.searchParams.set("currency", currency);
  url.searchParams.set("market", "DayAhead");
  url.searchParams.set("date", date);
  url.searchParams.set("resolutionInMinutes", resolution === "quarter" ? "15" : "60");
  url.searchParams.set("indexNames", priceArea);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Nord Pool API failed: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return { slots: [], currency };
  }

  const data = (await response.json()) as NordPoolResponse;
  const slots: PriceSlot[] = [];

  for (const entry of data.multiIndexEntries ?? []) {
    const price = entry.entryPerArea?.[priceArea];
    if (price == null) continue;

    slots.push({
      start: entry.deliveryStart,
      end: entry.deliveryEnd,
      priceEurPerMwh: price,
      priceEurPerKwh: price / 1000,
    });
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));

  return {
    slots,
    updatedAt: data.updatedAt,
    currency: data.currency ?? currency,
  };
}

export function buildDayPrices(
  date: string,
  label: "today" | "tomorrow",
  slots: PriceSlot[],
): DayPrices {
  if (slots.length === 0) {
    return {
      date,
      label,
      slots: [],
      minEurPerKwh: 0,
      maxEurPerKwh: 0,
      avgEurPerKwh: 0,
      available: false,
    };
  }

  const kwhPrices = slots.map((s) => s.priceEurPerKwh);
  const sum = kwhPrices.reduce((acc, v) => acc + v, 0);

  return {
    date,
    label,
    slots,
    minEurPerKwh: Math.min(...kwhPrices),
    maxEurPerKwh: Math.max(...kwhPrices),
    avgEurPerKwh: sum / kwhPrices.length,
    available: true,
  };
}

export function findCurrentAndNextPrice(
  slots: PriceSlot[],
  now: Date,
): { current: PriceSlot | null; next: PriceSlot | null } {
  const nowMs = now.getTime();
  let current: PriceSlot | null = null;
  let next: PriceSlot | null = null;

  for (const slot of slots) {
    const startMs = new Date(slot.start).getTime();
    const endMs = new Date(slot.end).getTime();

    if (nowMs >= startMs && nowMs < endMs) {
      current = slot;
    } else if (startMs > nowMs && !next) {
      next = slot;
    }
  }

  if (!next && current) {
    const currentIndex = slots.indexOf(current);
    if (currentIndex >= 0 && currentIndex < slots.length - 1) {
      next = slots[currentIndex + 1];
    }
  }

  return { current, next };
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
