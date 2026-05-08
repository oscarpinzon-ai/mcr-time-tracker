/**
 * Revenue Intelligence — server-only data fetching.
 * Reads from Supabase hcp_jobs_cache (instant, no HCP API call).
 * raw_data jsonb contains the full HCP response including payment fields.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// HCP response shape for revenue purposes
// ---------------------------------------------------------------------------
type HcpRevenueJob = {
  id: string;
  invoice_number?: string;
  job_number?: string;
  work_status?: string;

  total_amount?: number;
  balance_due?: number;
  outstanding_balance?: number;
  payment_status?: string;
  invoice_sent_at?: string;

  invoice?: {
    sent_at?: string;
    total?: number;
    balance_due?: number;
    subtotal?: number;
    payment_status?: string;
  };

  customer?: {
    company_name?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  schedule?: {
    scheduled_start?: string;
    scheduled_end?: string;
    completed_at?: string;
  };
  work_line_items?: Array<{
    name?: string;
    unit_price?: number;
    quantity?: number;
    total?: number;
  }>;

  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export type ReceivableJob = {
  jobId: string;
  jobNumber: string;
  customerName: string;
  invoiceValue: number;
  daysSinceInvoice: number;
};

export type PmCandidate = {
  customerName: string;
  totalJobs: number;
  totalRevenue: number;
  avgDaysToPay: number;
};

export type WeeklySnapshot = {
  jobsCompleted: number;
  revenueInvoiced: number;
  revenueCollected: number;
  jobsOpen: number;
};

export type RevenueData = {
  receivables: ReceivableJob[];
  totalAtRisk: number;
  atRiskCount: number;
  avgDaysOverdue: number;
  pmCandidates: PmCandidate[];
  weeklySnapshot: WeeklySnapshot;
  asOf: string;
  /** How many days of job history are in the cache */
  cacheDaysAvailable: number;
};

// ---------------------------------------------------------------------------
// Supabase client (server-side, no session persistence)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  // Prefer service role (bypasses RLS) but anon/publishable key also works
  // since hcp_jobs_cache has Allow-all RLS policies.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key)
    throw new Error(
      "Supabase env vars not set (need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY)",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Helpers — data extraction
// ---------------------------------------------------------------------------

function getCustomerName(job: HcpRevenueJob): string {
  if (job.customer?.company_name) return job.customer.company_name;
  if (job.customer?.name) return job.customer.name;
  const full = [job.customer?.first_name, job.customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (full) return full;
  return "Unknown Customer";
}

function getInvoiceTotal(job: HcpRevenueJob): number {
  if (typeof job.total_amount === "number" && job.total_amount > 0)
    return job.total_amount;
  if (typeof job.invoice?.total === "number" && job.invoice.total > 0)
    return job.invoice.total;
  if (typeof job.invoice?.subtotal === "number" && job.invoice.subtotal > 0)
    return job.invoice.subtotal;
  if (job.work_line_items?.length) {
    const sum = job.work_line_items.reduce((acc, item) => {
      if (typeof item.total === "number") return acc + item.total;
      const price = item.unit_price ?? 0;
      const qty = item.quantity ?? 1;
      return acc + price * qty;
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
}

function getBalanceDue(job: HcpRevenueJob): number {
  if (typeof job.balance_due === "number") return job.balance_due;
  if (typeof job.invoice?.balance_due === "number")
    return job.invoice.balance_due;
  if (typeof job.outstanding_balance === "number")
    return job.outstanding_balance;
  return -1;
}

function isUnpaid(job: HcpRevenueJob): boolean {
  const balance = getBalanceDue(job);
  if (balance !== -1) return balance > 0;
  const status =
    (job.payment_status as string | undefined) ??
    (job.invoice?.payment_status as string | undefined);
  if (status === "paid") return false;
  return true;
}

function getInvoiceSentAt(job: HcpRevenueJob): Date | null {
  const raw =
    job.invoice_sent_at ??
    job.invoice?.sent_at ??
    job.schedule?.completed_at ??
    job.schedule?.scheduled_end ??
    job.schedule?.scheduled_start;
  return raw ? new Date(raw as string) : null;
}

function isCompleted(job: HcpRevenueJob): boolean {
  return job.work_status === "complete" || job.work_status === "completed";
}

// ---------------------------------------------------------------------------
// Helpers — date/timezone
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

function getCurrentWeekBoundsCDT(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(now);

  const dayIndex: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const todayNum = dayIndex[weekdayStr] ?? 1;
  const daysSinceMon = todayNum === 0 ? 6 : todayNum - 1;

  const monday = new Date(now.getTime() - daysSinceMon * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);

  return {
    weekStart: toChicagoDateStr(monday),
    weekEnd: toChicagoDateStr(sunday),
  };
}

// ---------------------------------------------------------------------------
// Core data processing
// ---------------------------------------------------------------------------

function processRevenueData(
  jobs: HcpRevenueJob[],
  cacheDaysAvailable: number,
): RevenueData {
  const now = new Date();
  const todayStr = toChicagoDateStr(now);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
  const ninetyDaysAgoStr = toChicagoDateStr(ninetyDaysAgo);
  const { weekStart, weekEnd } = getCurrentWeekBoundsCDT();

  // ---- Section 1: Receivables ----
  const unpaidCompleted90d = jobs
    .filter((job) => {
      if (!isCompleted(job)) return false;
      if (!isUnpaid(job)) return false;
      const scheduledStr = job.schedule?.scheduled_start;
      if (!scheduledStr) return false;
      const scheduledDate = toChicagoDateStr(new Date(scheduledStr));
      return scheduledDate >= ninetyDaysAgoStr && scheduledDate <= todayStr;
    })
    .map((job): ReceivableJob => {
      const sentAt = getInvoiceSentAt(job);
      const daysSince = sentAt
        ? Math.floor((now.getTime() - sentAt.getTime()) / 86_400_000)
        : 0;
      return {
        jobId: job.id,
        jobNumber: job.invoice_number ?? job.job_number ?? job.id,
        customerName: getCustomerName(job),
        invoiceValue: getInvoiceTotal(job),
        daysSinceInvoice: daysSince,
      };
    })
    .sort((a, b) => b.daysSinceInvoice - a.daysSinceInvoice);

  const atRiskJobs = unpaidCompleted90d.filter((r) => r.daysSinceInvoice > 15);
  const totalAtRisk = atRiskJobs.reduce((s, r) => s + r.invoiceValue, 0);
  const avgDaysOverdue =
    atRiskJobs.length > 0
      ? Math.round(
          atRiskJobs.reduce((s, r) => s + r.daysSinceInvoice, 0) /
            atRiskJobs.length,
        )
      : 0;

  // ---- Section 2: PM Candidates ----
  const completedInWindow = jobs.filter((job) => {
    if (!isCompleted(job)) return false;
    const scheduledStr = job.schedule?.scheduled_start;
    if (!scheduledStr) return false;
    return toChicagoDateStr(new Date(scheduledStr)) >= ninetyDaysAgoStr;
  });

  const customerMap = new Map<string, { jobs: HcpRevenueJob[]; revenue: number }>();
  for (const job of completedInWindow) {
    const name = getCustomerName(job);
    const entry = customerMap.get(name) ?? { jobs: [], revenue: 0 };
    entry.jobs.push(job);
    entry.revenue += getInvoiceTotal(job);
    customerMap.set(name, entry);
  }

  const pmCandidates: PmCandidate[] = Array.from(customerMap.entries())
    .filter(([, e]) => e.jobs.length >= 3)
    .map(([name, e]) => ({
      customerName: name,
      totalJobs: e.jobs.length,
      totalRevenue: e.revenue,
      avgDaysToPay: 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---- Section 3: Weekly Snapshot ----
  const weekJobs = jobs.filter((job) => {
    const scheduledStr = job.schedule?.scheduled_start;
    if (!scheduledStr) return false;
    const d = toChicagoDateStr(new Date(scheduledStr));
    return d >= weekStart && d <= weekEnd;
  });

  const weekCompleted = weekJobs.filter(isCompleted);
  const weekOpen = weekJobs.filter(
    (j) =>
      !isCompleted(j) &&
      j.work_status !== "cancelled" &&
      j.work_status !== "canceled" &&
      j.work_status !== "pro_canceled" &&
      j.work_status !== "user_canceled",
  );

  const weeklySnapshot: WeeklySnapshot = {
    jobsCompleted: weekCompleted.length,
    revenueInvoiced: weekCompleted.reduce((s, j) => s + getInvoiceTotal(j), 0),
    revenueCollected: weekCompleted
      .filter((j) => !isUnpaid(j))
      .reduce((s, j) => s + getInvoiceTotal(j), 0),
    jobsOpen: weekOpen.length,
  };

  return {
    receivables: unpaidCompleted90d,
    totalAtRisk,
    atRiskCount: atRiskJobs.length,
    avgDaysOverdue,
    pmCandidates,
    weeklySnapshot,
    asOf: now.toISOString(),
    cacheDaysAvailable,
  };
}

// ---------------------------------------------------------------------------
// Exported server function — reads from Supabase cache (no HCP API call)
// ---------------------------------------------------------------------------

export const fetchRevenueData = createServerFn({ method: "GET" }).handler(
  async (): Promise<RevenueData> => {
    const supabase = getSupabase();

    // Pull all cached jobs — no date filter so we use everything available.
    // The cache is populated by the HCP sync cron; typically has 7-90+ days
    // depending on how long the sync has been running.
    const { data: rows, error } = await supabase
      .from("work_orders")
      .select("hcp_id, number, customer_name, hcp_status, scheduled_date, raw_data")
      .order("scheduled_date", { ascending: false });

    if (error) throw new Error(`Supabase error: ${error.message}`);

    const allRows = rows ?? [];

    const jobs: HcpRevenueJob[] = allRows.map((row) => {
      const raw = (row.raw_data ?? {}) as Record<string, unknown>;
      return {
        ...raw,
        id: String(row.hcp_id ?? row.number),
        work_status: (raw.work_status as string | undefined) ?? row.hcp_status ?? undefined,
        customer: (raw.customer as HcpRevenueJob["customer"]) ?? {
          company_name: row.customer_name ?? undefined,
        },
        schedule: (raw.schedule as HcpRevenueJob["schedule"]) ?? {
          scheduled_start: row.scheduled_date
            ? `${row.scheduled_date}T12:00:00`
            : undefined,
        },
      } as HcpRevenueJob;
    });

    // Determine how many days of history we actually have
    const dates = allRows
      .map((r) => r.scheduled_date)
      .filter(Boolean)
      .sort();
    let cacheDaysAvailable = 0;
    if (dates.length > 0) {
      const oldest = new Date(dates[0] + "T00:00:00");
      cacheDaysAvailable = Math.floor(
        (Date.now() - oldest.getTime()) / 86_400_000,
      );
    }

    return processRevenueData(jobs, cacheDaysAvailable);
  },
);
