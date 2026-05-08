// REMOVE BEFORE PRODUCTION — temporary endpoint to inspect raw HCP API response
// Used to verify actual field names for payment status, invoice sent date, and
// balance due before the revenue.functions.ts field mappings are finalized.
import { createFileRoute } from "@tanstack/react-router";

const HCP_BASE = "https://api.housecallpro.com";

export const Route = createFileRoute("/api/hcp-debug")({
  // No component — the GET handler returns a Response directly, which
  // TanStack Start delivers to the client without touching React rendering.
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.HCP_API_KEY;

        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error: "HCP_API_KEY is not set on the server.",
              hint: "Set it in .dev.vars (local) or as a Cloudflare Worker secret (production).",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Fetch the first job HCP returns with no status filter — we just need
        // to see the raw field structure regardless of job status.
        const url = new URL(`${HCP_BASE}/jobs`);
        url.searchParams.set("page", "1");
        url.searchParams.set("page_size", "1");

        let hcpRes: Response;
        try {
          hcpRes = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: "Network error reaching HCP API.",
              detail: err instanceof Error ? err.message : String(err),
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!hcpRes.ok) {
          const body = await hcpRes.text();
          return new Response(
            JSON.stringify({
              error: `HCP API responded with ${hcpRes.status} ${hcpRes.statusText}`,
              body: body.slice(0, 2000),
            }),
            {
              status: hcpRes.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Return the raw payload exactly as HCP sent it — pretty-printed for readability.
        const raw = await hcpRes.json();
        return new Response(JSON.stringify(raw, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
