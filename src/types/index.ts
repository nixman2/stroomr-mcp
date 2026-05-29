export interface LocationInput {
  city?: string;
  latitude?: number;
  longitude?: number;
  priceArea?: string;
}

export type LocationSource = "tool_arg" | "env" | "geocoded";

export interface ResolvedLocation {
  name: string;
  country: string;
  countryCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
  priceArea: string | null;
  supported: boolean;
  source: LocationSource;
  note?: string;
}

export interface LocationError {
  error: true;
  message: string;
  suggestions?: string[];
  energyOnly?: boolean;
  priceArea?: string;
}

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  timezone: string;
  admin1?: string;
}

export interface HourlyWeatherSlot {
  time: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  cloudCoverPercent: number | null;
  shortwaveRadiation: number | null;
  sunshineDurationSeconds: number | null;
  weatherCode: number | null;
}

export interface DailyWeatherSummary {
  date: string;
  label: "today" | "tomorrow" | "day";
  sunshineTotalHours: number;
  precipitationTotalMm: number;
  precipitationHours: number;
  sunrise: string | null;
  sunset: string | null;
  sunWindows: TimeWindow[];
  rainPeriods: RainPeriod[];
  minTempC: number | null;
  maxTempC: number | null;
  summaryNl: string;
}

export interface TimeWindow {
  start: string;
  end: string;
  hours: number;
}

export interface RainPeriod {
  start: string;
  end: string;
  totalMm: number;
}

export interface WeatherForecastResult {
  location: ResolvedLocation;
  timezone: string;
  hourly: HourlyWeatherSlot[];
  daily: DailyWeatherSummary[];
}

export interface PriceSlot {
  start: string;
  end: string;
  priceEurPerMwh: number;
  priceEurPerKwh: number;
}

export interface DayPrices {
  date: string;
  label: "today" | "tomorrow";
  slots: PriceSlot[];
  minEurPerKwh: number;
  maxEurPerKwh: number;
  avgEurPerKwh: number;
  available: boolean;
  status?: string;
}

export interface EnergyPricesResult {
  priceArea: string;
  currency: string;
  resolution: "hour" | "quarter";
  timezone: string;
  currentPrice: PriceSlot | null;
  nextPrice: PriceSlot | null;
  today: DayPrices;
  tomorrow: DayPrices;
  tomorrowAvailable: boolean;
  updatedAt?: string;
}

export interface CombinedResult {
  location: ResolvedLocation;
  weather: WeatherForecastResult;
  energy: EnergyPricesResult;
}
