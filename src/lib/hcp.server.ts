/**
 * Server-only HouseCall Pro API helpers.
 * Never import this file from client code.
 */

const HCP_BASE = "https://api.housecallpro.com";

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
      Authorization: `Token ${getApiKey()}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HCP API error [${res.status}] ${path}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
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
export function mapHcpJob(job: HcpJob) {
  const customerName =
    job.customer?.name ??
    [job.customer?.first_name, job.customer?.last_name].filter(Boolean).join(" ").trim() ??
    null;

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

  const scheduledDate = job.schedule?.scheduled_start
    ? job.schedule.scheduled_start.slice(0, 10)
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
