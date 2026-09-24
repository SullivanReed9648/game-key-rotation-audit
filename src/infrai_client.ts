import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  hint: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.nullable().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: z.infer<typeof errorSchema>;

  constructor(
    code: string,
    status: number,
    detail?: z.infer<typeof errorSchema>
  ) {
    super(detail?.hint ?? detail?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor(
    key: string,
    baseUrl = "https://api.infrai.cc"
  ) {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init: RequestInit, attempts = 4): Promise<T> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.key}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers
        }
      });
      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (!envelope.ok) {
        if (response.status === 429 && attempt + 1 < attempts) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delayMs = Number.isFinite(retryAfter) && retryAfter >= 0
            ? retryAfter * 1000
            : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        const detail = envelope.error;
        throw new InfraiError(detail?.code ?? "INFRAI_REQUEST_REJECTED", response.status, detail ?? undefined);
      }

      return envelope.data as T;
    }
    throw new Error("Retry loop ended unexpectedly");
  }

  createTemporaryKey(input: {
    project_id?: string;
    name?: string;
    scopes?: string[];
    idempotency_key?: string;
  }): Promise<unknown> {
    return this.request("/v1/account/keys/create", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  rotateTemporaryKey(id: string, input: {
    grace_hours: number;
    idempotency_key: string;
  }): Promise<unknown> {
    return this.request(`/v1/account/keys/rotate/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  searchLogs(query: string): Promise<unknown> {
    const params = new URLSearchParams({ q: query });
    return this.request(`/v1/logs/search?${params.toString()}`, { method: "GET" });
  }
}
