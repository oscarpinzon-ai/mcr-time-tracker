// Server-only HCP fetch helper. Reads HCP_API_KEY from process.env at call time.
const HCP_BASE_URL = "https://api.housecallpro.com";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export async function hcpFetch<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const apiKey = process.env.HCP_API_KEY;
  if (!apiKey) throw new Error("HCP_API_KEY is not configured");

  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
  }
  const qs = params.toString();
  const url = `${HCP_BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt - 1)),
        );
        continue;
      }
      throw new Error(`HCP API error: ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES) throw lastError;
    }
  }
  throw lastError ?? new Error("HCP fetch failed");
}
