/**
 * Server-only HouseCall Pro API helpers.
 * Never import this file from client code.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const HCP_BASE = "https://api.housecallpro.com";

function getServerSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing on server");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type HcpEmployee = {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  role?: string;
};

export type HcpJob = {
  id: string;
  invoice_number?: string;
  job_number?: string;
  customer?: { first_name?: string; last_name?: string; name?: string };
  address?: {
    street?: string;
    street_line_2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  work_status?: string;
  schedule?: { scheduled_start?: string; scheduled_end?: string };
  assigned_employees?: Array<{ id: string }>;
  dispatched_employees?: Array<{ id: string }>;
  description?: string;
  tags?: string[];
  work_line_items?: Array<{ name?: string }>;
};

function getApiKey(): string {
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const key = process.env.HCP_API_KEY ?? runtimeEnv?.HCP_API_KEY;

  if (!key) {
    throw new Error(
      "HCP_API_KEY is not available in the backend runtime yet. Re-save the secret and retry, or publish before testing sync.",
    );
  }

  return key;
}

export async function hcpFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${HCP_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HCP API error [${res.status}] ${path}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

/** Build a map of customer email → customer company name for lookups. */
export async function buildCustomerEmailMap(): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  let page = 1;
  const pageSize = 100;

  while (page < 100) {
    const data = await hcpFetch<{ customers?: any[]; data?: any[] }>("/customers", {
      page,
      page_size: pageSize,
    });
    const list = data.customers ?? data.data ?? [];

    list.forEach((customer: any) => {
      if (customer.email && customer.company_name) {
        emailMap.set(customer.email.toLowerCase(), customer.company_name);
      }
    });

    if (list.length < pageSize) break;
    page++;
  }

  return emailMap;
}

/** Fetch all employees, paginating through results. */
export async function fetchAllEmployees(): Promise<HcpEmployee[]> {
  const all: HcpEmployee[] = [];
  let page = 1;
  const pageSize = 100;
  // Safety cap
  while (page < 50) {
    const data = await hcpFetch<{ employees?: HcpEmployee[]; data?: HcpEmployee[]; page?: number; total_pages?: number }>(
      "/employees",
      { page, page_size: pageSize },
    );
    const list = data.employees ?? data.data ?? [];
    all.push(...list);
    if (list.length < pageSize) break;
    page++;
  }
  return all;
}

/** Fetch jobs scheduled within a date range (YYYY-MM-DD). */
export async function fetchJobsInRange(startDate: string, endDate: string): Promise<HcpJob[]> {
  const all: HcpJob[] = [];
  let page = 1;
  const pageSize = 100;
  while (page < 100) {
    const data = await hcpFetch<{ jobs?: HcpJob[]; data?: HcpJob[] }>("/jobs", {
      page,
      page_size: pageSize,
      scheduled_start_min: startDate,
      scheduled_start_max: endDate,
    });
    const list = data.jobs ?? data.data ?? [];
    all.push(...list);
    if (list.length < pageSize) break;
    page++;
  }
  return all;
}

/** Map an HCP job into our hcp_jobs_cache row. */
export function mapHcpJob(job: HcpJob, customerEmailMap?: Map<string, string>) {
  // Try to get the real customer name from email map first
  let customerName: string | null = null;

  if (customerEmailMap && job.customer?.email) {
    const mappedName = customerEmailMap.get(job.customer.email.toLowerCase());
    if (mappedName) {
      customerName = mappedName;
    }
  }

  // Fallback to existing logic if not found in map
  if (!customerName) {
    customerName =
      job.customer?.company_name ??
      job.customer?.name ??
      [job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ").trim() ??
      null;
  }

  const addressParts = [
    job.address?.street,
    job.address?.street_line_2,
    job.address?.city,
    job.address?.state,
    job.address?.zip,
  ].filter(Boolean);
  const jobAddress = addressParts.length ? addressParts.join(", ") : null;

  // Map work_status to our schema
  const statusMap: Record<string, string> = {
    needs_scheduling: "scheduled",
    scheduled: "scheduled",
    in_progress: "in_progress",
    complete: "completed",
    completed: "completed",
    canceled: "cancelled",
    cancelled: "cancelled",
    pro_canceled: "cancelled",
    user_canceled: "cancelled",
  };
  const status = statusMap[job.work_status ?? ""] ?? job.work_status ?? null;

  // Infer job type from tags or work line items
  const haystack = [
    ...(job.tags ?? []),
    ...(job.work_line_items?.map((w) => w.name ?? "") ?? []),
    job.description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let jobType: string | null = null;
  if (/install|removal|remov/.test(haystack)) jobType = "Installation / Removal";
  else if (/yard/.test(haystack)) jobType = "Yard Work";
  else jobType = "Service Call / Repair";

  // Extract scheduled date in CDT, not UTC
  const scheduledDate = job.schedule?.scheduled_start
    ? (() => {
        const date = new Date(job.schedule.scheduled_start);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const parts = formatter.formatToParts(date);
        const year = parts.find(p => p.type === 'year')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        return `${year}-${month}-${day}`;
      })()
    : null;

  const assigned = (job.assigned_employees ?? job.dispatched_employees ?? [])
    .map((e) => e.id)
    .filter(Boolean);

  return {
    hcp_job_id: job.id,
    job_number: job.invoice_number ?? job.job_number ?? job.id,
    customer_name: customerName || null,
    job_type: jobType,
    job_address: jobAddress,
    status,
    scheduled_date: scheduledDate,
    assigned_employee_ids: assigned,
    raw_data: job as unknown as Record<string, unknown>,
    last_synced_at: new Date().toISOString(),
  };
}

type HcpSyncErrorResult = {
  ok: false;
  error: string;
};

type HcpJobSyncResult =
  | {
      ok: true;
      total: number;
      upserted: number;
      range: { start: string; end: string };
    }
  | HcpSyncErrorResult;

// Core sync logic that can be called from cron or client
export async function performHcpJobSync(data?: { startDate?: string; endDate?: string }): Promise<HcpJobSyncResult> {
  try {
    const supabase = getServerSupabase();

    // Get today's date in CDT, not UTC
    const getTodayInCDT = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${year}-${month}-${day}`;
    };

    const getTodayDate = () => {
      const str = getTodayInCDT();
      return new Date(str + 'T00:00:00Z');
    };

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const today = getTodayDate();
    const start = data?.startDate ?? fmt(new Date(today.getTime() - 7 * 86400000));
    const end = data?.endDate ?? fmt(new Date(today.getTime() + 7 * 86400000));

    const jobs = await fetchJobsInRange(start, end);
    const customerEmailMap = await buildCustomerEmailMap();
    const rows = jobs.map((job) => mapHcpJob(job, customerEmailMap));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50).map((r) => ({
        ...r,
        raw_data: JSON.parse(JSON.stringify(r.raw_data)),
      }));
      const { error } = await supabase
        .from("hcp_jobs_cache")
        .upsert(batch, { onConflict: "hcp_job_id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
      upserted += batch.length;
    }

    return { ok: true, total: jobs.length, upserted, range: { start, end } };
  } catch (error) {
    console.error("HCP job sync failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Job sync failed",
    };
  }
}

// Core auto clock-out logic that can be called from cron or client
export async function performAutoClockOut(): Promise<{ ok: true; clockedOut: number } | HcpSyncErrorResult> {
  try {
    const supabase = getServerSupabase();

    // Get 7 PM CDT time for today
    const get7pmCDT = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      const dateStr = `${year}-${month}-${day}T19:00:00Z`;
      return new Date(dateStr);
    };

    const clockOutTime = get7pmCDT().toISOString();

    // Find all active/paused entries with no clock_out
    const { data: entries, error: fetchErr } = await supabase
      .from("time_entries")
      .select("id, clock_in, total_minutes")
      .in("status", ["active", "paused"])
      .is("clock_out", null);

    if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);

    let clockedOut = 0;

    for (const entry of entries ?? []) {
      // Close any open pause logs
      await supabase
        .from("pause_logs")
        .update({ pause_end: clockOutTime })
        .eq("time_entry_id", entry.id)
        .is("pause_end", null);

      // Calculate total minutes
      const clockInTime = new Date(entry.clock_in);
      const clockOutDate = new Date(clockOutTime);
      const totalMinutes = Math.floor((clockOutDate.getTime() - clockInTime.getTime()) / 60000);

      // Update time entry
      const { error: updateErr } = await supabase
        .from("time_entries")
        .update({
          clock_out: clockOutTime,
          status: "completed",
          total_minutes: totalMinutes,
        })
        .eq("id", entry.id);

      if (!updateErr) {
        // Log the edit
        await supabase.from("admin_edits_log").insert({
          time_entry_id: entry.id,
          edited_by: "System (Auto Clock-Out)",
          field_changed: "clock_out",
          old_value: null,
          new_value: clockOutTime,
        });
        clockedOut++;
      }
    }

    return { ok: true, clockedOut };
  } catch (error) {
    console.error("Auto clock-out failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Auto clock-out failed",
    };
  }
}
