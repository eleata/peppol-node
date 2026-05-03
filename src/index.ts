/**
 * @eleata/peppol — Node SDK for eleata Peppol API.
 *
 * Defaults: timeout 15s, 3 retries with exponential backoff, max payload 5MB.
 * Override via constructor options.
 */

export type Format = "peppol-bis-3" | "xrechnung-2.x" | "factur-x" | "ubl";

export interface EleataOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  maxPayload?: number;
}

export interface ValidateRequest {
  format: Format;
  xml: Buffer | Uint8Array | string;
}

export interface ValidationError {
  level: "ERROR" | "FATAL" | "WARN";
  rule_id?: string;
  message: string;
  location?: string;
}

export interface ValidationResult {
  valid: boolean;
  format: Format;
  errors: ValidationError[];
  warnings: ValidationError[];
  public_id: string;
  report_url: string;
  duration_ms: number;
}

export interface BatchRequest {
  format: Format;
  files: Array<{ id: string; xml: Buffer | Uint8Array | string }>;
  webhookUrl?: string;
}

export interface BatchJob {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  total_files: number;
}

const DEFAULT_BASE_URL = "https://api.eleata.io";
const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_MAX_PAYLOAD = 5_000_000;

export class EleataError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: unknown) {
    super(message);
    this.name = "EleataError";
  }
}

export class Eleata {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly maxPayload: number;

  constructor(opts: EleataOptions) {
    if (!opts.apiKey) throw new EleataError("apiKey required");
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = opts.maxRetries ?? DEFAULT_RETRIES;
    this.maxPayload = opts.maxPayload ?? DEFAULT_MAX_PAYLOAD;
  }

  async validate(req: ValidateRequest): Promise<ValidationResult> {
    const xmlBuffer = this.toBuffer(req.xml);
    if (xmlBuffer.length > this.maxPayload) {
      throw new EleataError(`payload exceeds ${this.maxPayload} bytes`);
    }
    return this.fetchWithRetry<ValidationResult>(
      `/v1/validate?format=${encodeURIComponent(req.format)}`,
      { method: "POST", headers: { "Content-Type": "application/xml" }, body: xmlBuffer },
    );
  }

  async validateBatch(req: BatchRequest): Promise<BatchJob> {
    const payload = JSON.stringify({
      format: req.format,
      files: req.files.map((f) => ({ id: f.id, xml: this.toBase64(f.xml) })),
      webhook_url: req.webhookUrl,
    });
    return this.fetchWithRetry<BatchJob>("/v1/validate/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  }

  async getJob(jobId: string): Promise<BatchJob> {
    return this.fetchWithRetry<BatchJob>(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
  }

  async usage(): Promise<{ plan: string; validations: { this_month: number; today: number; total: number } }> {
    return this.fetchWithRetry("/v1/usage", { method: "GET" });
  }

  private async fetchWithRetry<T>(path: string, init: RequestInit): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeout);
        try {
          const r = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
              ...(init.headers ?? {}),
              Authorization: `Bearer ${this.apiKey}`,
              "User-Agent": "eleata-node/0.1.0",
            },
            signal: ctrl.signal,
          });
          if (r.status >= 500 && attempt < this.maxRetries) {
            throw new EleataError(`server error ${r.status}`, r.status);
          }
          if (!r.ok) {
            const body = await r.text();
            throw new EleataError(`HTTP ${r.status}: ${body}`, r.status, body);
          }
          return (await r.json()) as T;
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries) {
          const delay = 200 * Math.pow(4, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  private toBuffer(input: Buffer | Uint8Array | string): Buffer {
    if (Buffer.isBuffer(input)) return input;
    if (input instanceof Uint8Array) return Buffer.from(input);
    return Buffer.from(input, "utf8");
  }

  private toBase64(input: Buffer | Uint8Array | string): string {
    return this.toBuffer(input).toString("base64");
  }
}
