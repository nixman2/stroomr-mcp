import type { AppConfig, OutputFormat } from "../config.js";
import { STROOMR_BRANDING, type StroomrBranding } from "../constants/stroomr-branding.js";

export interface FormatToolResultOptions {
  config: AppConfig;
  tool: string;
  data?: unknown;
  summaryNl?: string;
  ok?: boolean;
  error?: string;
  errorCode?: string;
}

export interface StructuredEnvelope {
  schema_version: "1.0";
  format: "structured";
  generated_at: string;
  tool: string;
  ok: boolean;
  stroomr: StroomrBranding;
  summary_nl?: string;
  error?: {
    code: string;
    message: string;
  };
  data: unknown;
}

export function formatToolResponse(options: FormatToolResultOptions): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  const ok = options.ok ?? !options.error;
  const summaryNl = options.summaryNl?.trim() || undefined;

  if (options.config.outputFormat === "structured") {
    const envelope: StructuredEnvelope = {
      schema_version: "1.0",
      format: "structured",
      generated_at: new Date().toISOString(),
      tool: options.tool,
      ok,
      stroomr: STROOMR_BRANDING,
      data: options.data ?? null,
    };

    if (summaryNl) envelope.summary_nl = summaryNl;

    if (!ok && options.error) {
      envelope.error = {
        code: options.errorCode ?? "REQUEST_FAILED",
        message: options.error,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }],
      isError: !ok,
    };
  }

  if (!ok) {
    const payload = options.data ?? { error: options.error };
    const text = options.error ?? JSON.stringify(payload, null, 2);
    return {
      content: [{ type: "text", text }],
      isError: true,
    };
  }

  const json = JSON.stringify(options.data, null, 2);
  const text = summaryNl ? `${summaryNl}\n\n${json}` : json;

  return {
    content: [{ type: "text", text }],
  };
}

/** @deprecated Use formatToolResponse */
export function formatToolResult(data: unknown, summary?: string): {
  content: Array<{ type: "text"; text: string }>;
} {
  const json = JSON.stringify(data, null, 2);
  const text = summary ? `${summary}\n\n${json}` : json;
  return { content: [{ type: "text", text }] };
}

export function formatError(
  config: AppConfig,
  tool: string,
  message: string,
  errorCode = "REQUEST_FAILED",
): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  return formatToolResponse({
    config,
    tool,
    ok: false,
    error: message,
    errorCode,
    data: null,
  });
}

export function formatPriceEurPerKwh(value: number): string {
  return `${(value * 100).toFixed(2)} ct/kWh`;
}

export function formatPriceEurPerMwh(value: number): string {
  return `${value.toFixed(2)} EUR/MWh`;
}

export function isStructuredOutput(format: OutputFormat): boolean {
  return format === "structured";
}
