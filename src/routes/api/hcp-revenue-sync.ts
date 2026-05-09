/**
 * GET /api/hcp-revenue-sync
 * Fetches 90 days of jobs from HCP and upserts them into hcp_jobs_cache.
 * Uses server.handlers to get the full Cloudflare Worker timeout (not the
 * shorter createServerFn budget).
 *
 * HCP API key is read from Supabase app_config table (key='hcp_api_key')
 * so it works in Lovable preview (which doesn't inject Cloudflare secrets).
 *
 * Query params (all optional):
 *   days=90      — how many days back to fetch (default 90, max 365)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { parseServiceReference } from "@/lib/service-reference";

const HCP_BASE = "https://api.housecallpro.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toChicagoDateStr(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function mapStatus(hcpStatus: string | undefined): string {
  if (!hcpStatus) return "scheduled";
  const s = hcpStatus.toLowerCase();
  if (s === "complete" || s === "completed") return "completed";
  if (s === "in_progress" || s === "working") return "in_progress";
  if (s === "scheduled" || s === "unscheduled") return "scheduled";
  if (s.includes("cancel")) return "cancelled";
  return hcpStatus;
}

const MCR_RE = /modern compactor repair|^mcr$/i;
function isOwnCompany(s: string): boolean { return MCR_RE.test(s.trim()); }

function getCustomerName(job: Record<string, unknown>): string | null {
  // Try location/address name first (most specific: "Target Round Rock")
  const loc = job.location as Record<string, unknown> | undefined;
  const locName = (loc?.name ?? (loc?.address as Record<string,string>|undefined)?.name) as string | undefined;
  if (locName && !isOwnCompany(locName)) return locName;

  const addr = job.address as Record<string, string> | undefined;
  if (addr?.name && !isOwnCompany(addr.name)) return addr.name;

  const c = job.customer as Record<string, string> | undefined;
  if (c?.company_name && !isOwnCompany(c.company_name)) return c.company_name;
  if (c?.name && !isOwnCompany(c.name)) return c.name;
  const full = [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();
  if (full && !isOwnCompany(full)) return full;

  // Fallback: street + city as site identifier
  if (addr?.street && addr?.city) return `${addr.street}, ${addr.city}`;
  if (addr?.city) return addr.city;
  return null;
}

function getJobAddress(job: Record<string, unknown>): string | null {
  const a = job.address as Record<string, string> | undefined;
  if (!a) return null;
  return [a.street, a.city, a.state, a.zip].filter(Boolean).join(", ") || null;
}

function getScheduledDate(job: Record<string, unknown>): string | null {
  const sched = job.schedule as Record<string, string> | undefined;
  const raw = sched?.scheduled_start;
  if (!raw) return null;
  return toChicagoDateStr(new Date(raw));
}

function getJobType(job: Record<string, unknown>): string | null {
  const items = job.work_line_items as Array<{ name?: string }> | undefined;
  if (items?.[0]?.name) return items[0].name;
  const tags = job.tags as string[] | undefined;
  if (tags?.[0]) return tags[0];
  return null;
}

function getAssignedEmployeeIds(job: Record<string, unknown>): string[] {
  const emps = (job.dispatched_employees ??
    job.assigned_employees) as Array<{ id?: string }> | undefined;
  return (emps ?? []).map((e) => e.id).filter(Boolean) as string[];
}

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/hcp-revenue-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Read HCP API key from Supabase app_config (works in Lovable preview
        // where Cloudflare Worker secrets are not injected into process.env).
        // Fall back to process.env for production Cloudflare Worker deployments.
        let apiKey = process.env.HCP_API_KEY ?? "";
        if (!apiKey) {
          try {
            const cfgClient = getSupabase();
            const { data: cfg } = await cfgClient
              .from("app_config")
              .select("value")
              .eq("key", "hcp_api_key")
              .single();
            apiKey = cfg?.value ?? "";
          } catch {
            // ignore — will fail below with a clear message
          }
        }
        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error:
                "HCP API key not found. Add a row with key='hcp_api_key' to the app_config table in Supabase.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Parse optional ?days= param
        const url = new URL(request.url);
        const daysParam = parseInt(url.searchParams.get("days") ?? "90", 10);
        const days = Math.min(Math.max(daysParam, 1), 365);

        const now = new Date();
        const startDate = toChicagoDateStr(
          new Date(now.getTime() - days * 86_400_000),
        );
        const endDate = toChicagoDateStr(now);

        // ---- Fetch from HCP (paginated, cap at 10 pages = 2000 jobs) ----
        type HcpJob = Record<string, unknown>;
        const allJobs: HcpJob[] = [];
        let page = 1;
        const pageSize = 200;
        let totalPages = 1;

        try {
          while (page <= 10) {
            const fetchUrl = new URL(`${HCP_BASE}/jobs`);
            fetchUrl.searchParams.set("page", String(page));
            fetchUrl.searchParams.set("page_size", String(pageSize));
            fetchUrl.searchParams.set("scheduled_start_min", startDate);
            fetchUrl.searchParams.set("scheduled_start_max", endDate);

            const res = await fetch(fetchUrl.toString(), {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
              },
            });

            if (!res.ok) {
              const body = await res.text();
              return new Response(
                JSON.stringify({
                  error: `HCP API error: ${res.status} ${res.statusText}`,
                  body: body.slice(0, 500),
                }),
                {
                  status: res.status,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            const data = (await res.json()) as {
              jobs?: HcpJob[];
              data?: HcpJob[];
              total_pages?: number;
            };

            const list = data.jobs ?? data.data ?? [];
            allJobs.push(...list);
            totalPages = data.total_pages ?? 1;

            if (page >= totalPages || list.length < pageSize) break;
            page++;
          }
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: "Network error reaching HCP",
              detail: err instanceof Error ? err.message : String(err),
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        // ---- Upsert into hcp_jobs_cache ----
        let supabase;
        try {
          supabase = getSupabase();
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: "Supabase config error",
              detail: err instanceof Error ? err.message : String(err),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const rows = allJobs.map((job) => {
          const serviceRef = getJobType(job);
          const parsed = parseServiceReference(serviceRef);
          return {
            hcp_id: String(job.id),
            number: String(
              job.invoice_number ?? job.job_number ?? job.id,
            ),
            customer_name: getCustomerName(job),
            hcp_type: "job",
            description: serviceRef,
            work_order_number: parsed.work_order_number,
            purchase_order_number: parsed.purchase_order_number,
            job_site_name: parsed.job_site_name,
            address: getJobAddress(job),
            hcp_status: mapStatus(job.work_status as string | undefined),
            scheduled_date: getScheduledDate(job),
            assigned_to: (getAssignedEmployeeIds(job) ?? []).join(",") || null,
            last_synced_at: new Date().toISOString(),
            raw_data: job,
          };
        });

        // Determine which hcp_ids already exist (to distinguish insert vs update)
        const allIds = rows.map((r) => r.hcp_id);
        const existingIds = new Set<string>();
        const ID_BATCH = 500;
        for (let i = 0; i < allIds.length; i += ID_BATCH) {
          const slice = allIds.slice(i, i + ID_BATCH);
          const { data: existing, error: selErr } = await supabase
            .from("work_orders")
            .select("hcp_id")
            .in("hcp_id", slice);
          if (selErr) {
            return new Response(
              JSON.stringify({
                error: "Supabase select error",
                detail: selErr.message,
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          for (const r of existing ?? []) {
            if (r.hcp_id) existingIds.add(r.hcp_id);
          }
        }

        // Upsert in batches of 100; track failures per batch instead of aborting
        const BATCH = 100;
        let inserted = 0;
        let updated = 0;
        let failed = 0;
        const errors: string[] = [];
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          const { error } = await supabase.from("work_orders").upsert(
            batch,
            { onConflict: "hcp_id" },
          );
          if (error) {
            failed += batch.length;
            if (errors.length < 3) errors.push(error.message);
            continue;
          }
          for (const r of batch) {
            if (existingIds.has(r.hcp_id)) updated++;
            else inserted++;
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            fetched: allJobs.length,
            inserted,
            updated,
            failed,
            upserted: inserted + updated,
            errors,
            dateRange: { from: startDate, to: endDate },
            hcpPages: page,
            hcpTotalPages: totalPages,
            syncedAt: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
