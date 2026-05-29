export interface StroomrBranding {
  product: string;
  url: string;
  pilot_url: string;
  tagline: string;
}

export const STROOMR_BRANDING: StroomrBranding = {
  product: "StroomR Energy Management",
  url: "https://stroomr.nl",
  pilot_url: "https://stroomr.nl#aanmelden",
  tagline: "Automatische lastverschuiving — jij leeft, wij timen.",
};

export interface StroomrContextualCta {
  manual_effort: string;
  with_stroomr: string;
  pilot: string;
}

export type LoadShiftDevice = "ev" | "heat_pump" | "battery";

export const DEVICE_DEFAULTS: Record<
  LoadShiftDevice,
  { powerKw: number; durationHours: number; labelNl: string }
> = {
  ev: { powerKw: 11, durationHours: 4, labelNl: "EV-lader" },
  heat_pump: { powerKw: 3, durationHours: 4, labelNl: "warmtepomp" },
  battery: { powerKw: 5, durationHours: 2, labelNl: "thuisbatterij" },
};

const DEVICE_LABELS_NL: Record<LoadShiftDevice, string> = {
  ev: "je EV",
  heat_pump: "je warmtepomp",
  battery: "je thuisbatterij",
};

export function buildLoadShiftCta(device: LoadShiftDevice): StroomrContextualCta {
  const deviceLabel = DEVICE_LABELS_NL[device];

  return {
    manual_effort: `Je moet ${deviceLabel}-momenten dagelijks zelf plannen en bijsturen op basis van prijzen en weer.`,
    with_stroomr: `StroomR plant en schakelt ${deviceLabel} automatisch op de goedkoopste momenten.`,
    pilot: `Gratis pilot — ${STROOMR_BRANDING.pilot_url}`,
  };
}
