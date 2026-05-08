/**
 * Revenue Intelligence — server-only data fetching.
 * Calls HCP API directly (not the cache) to get fresh 365-day job history.
 * Never import this from client-side code; it uses hcpFetch which reads
 * process.env.HCP_API_KEY.
 */
import { createServerFn } from "@tanstack/react-start";
import { hcpFetch } from "@/lib/hcp.server";

// ---------------------------------------------------------------------------
// HCP response shape for revenue purposes
// We extend the base type with payment/invoice fields that HCP returns but
// that aren't mapped in the standard hcp_jobs_cache flow.
//
// Field notes (HCP API v1):
//   total_amount      — top-level invoice total (dollars)
//   outstanding_balance / balance_due — remaining unpaid amount; if > 0 the
//                       invoice is unpaid. We prefer balance_due per spec.
//   invoice_sent_at   — ISO timestamp when the invoice was emailed/sent.
//   payment_status    — "paid" | "unpaid" | etc. (not always present).
//   invoice.*         — some HCP responses nest the same fields under invoice{}.
// ---------------------------------------------------------------------------
type HcpRevenueJob = {
  id: string;
  invoice_number?: string;
  job_number?: string;
  work_status?: string;

  // Invoice / payment — use balance_due as primary indicator (spec requirement)
  total_amount?: number;
  balance_due?: number;
  outstanding_balance?: number;
  payment_status?: string;
  invoice_sent_at?: string;

  // Nested invoice object (alternate HCP response shape)
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

type HcpJobsPage = {
  jobs?: HcpRevenueJob[];
  data?: HcpRevenueJob[];
  total_pages?: number;
  page?: number;
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
  avgDaysToPay: number; // 0 if HCP doesn't expose payment-received date
};

export type WeeklySnapshot = {
  jobsCompleted: number;
  revenueInvoiced: number;
  revenueCollected: number;
  jobsOpen: number;
};

export type RevenueData = {
  /** All unpaid completed jobs in last 90 days, sorted worst-first. */
  receivables: ReceivableJob[];
  /** Sum of invoices where daysSinceInvoice > 15. */
  totalAtRisk: number;
  /** Number of receivable jobs where daysSinceInvoice > 15. */
  atRiskCount: number;
  /** Average days overdue among at-risk jobs. */
  avgDaysOverdue: number;
  /** Customers with 3+ completed jobs in last 12 months. */
  pmCandidates: PmCandidate[];
  weeklySnapshot: WeeklySnapshot;
  /** ISO timestamp of when this data was fetched. */
  asOf: string;
};

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
  // 1. top-level total_amount (most common)
  if (typeof job.total_amount === "number" && job.total_amount > 0)
    return job.total_amount;
  // 2. nested invoice object
  if (typeof job.invoice?.total === "number" && job.invoice.total > 0)
    return job.invoice.total;
  if (typeof job.invoice?.subtotal === "number" && job.invoice.subtotal > 0)
    return job.invoice.subtotal;
  // 3. sum work line items
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

/** Returns remaining balance in dollars; -1 means "unknown" (no data). */
function getBalanceDue(job: HcpRevenueJob): number {
  // balance_due is the primary indicator per spec
  if (typeof job.balance_due === "number") return job.balance_due;
  if (typeof job.invoice?.balance_due === "number")
    return job.invoice.balance_due;
  if (typeof job.outstanding_balance === "number")
    return job.outstanding_balance;
  return -1; // unknown
}

/** Returns false only when we can clearly confirm the invoice is paid. */
function isUnpaid(job: HcpRevenueJob): boolean {
  const balance = getBalanceDue(job);
  if (balance !== -1) return balance > 0;
  // Fall back to payment_status string if balance not available
  const status =
    (job.payment_status as string | undefined) ??
    (job.invoice?.payment_status as string | undefined);
  if (status === "paid") return false;
  // If we have no data at all, treat as unpaid (conservative / catches more)
  return true;
}

/** Best-effort date for when the invoice was sent or the job completed. */
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

/** Returns a YYYY-MM-DD string for any Date in America/Chicago. */
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

/** Returns YYYY-MM-DD of Monday and Sunday of the current CDT week. */
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
  // Days elapsed since Monday (Mon=0 … Sun=6)
  const daysSinceMon = todayNum === 0 ? 6 : todayNum - 1;

  const monday = new Date(now.getTime() - daysSinceMon * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);

  return {
    weekStart: toChicagoDateStr(monday),
    weekEnd: toChicagoDateStr(sunday),
  };
}

// ---------------------------------------------------------------------------
// HCP data fetching
// ---------------------------------------------------------------------------

/** Fetches all jobs scheduled in [startDate, endDate] (YYYY-MM-DD).
 *  Hard-capped at 5 pages (1 000 jobs) to stay inside Cloudflare's 30s limit. */
async function fetchAllJobsInRange(
  startDate: string,
  endDate: string,
): Promise<HcpRevenueJob[]> {
  const all: HcpRevenueJob[] = [];
  let page = 1;
  const pageSize = 200;

  while (page <= 5) {
    const data = await hcpFetch<HcpJobsPage>("/jobs", {
      page,
      page_size: pageSize,
      scheduled_start_min: startDate,
      scheduled_start_max: endDate,
    });

    const list = data.jobs ?? data.data ?? [];
    all.push(...list);

    const totalPages = data.total_pages ?? 1;
    if (page >= totalPages || list.length < pageSize) break;
    page++;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Core data processing
// ---------------------------------------------------------------------------

function processRevenueData(jobs: HcpRevenueJob[]): RevenueData {
  const now = new Date();
  const todayStr = toChicagoDateStr(now);

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
  const ninetyDaysAgoStr = toChicagoDateStr(ninetyDaysAgo);

  // PM window matches the fetch window (90 days). Label in the UI reflects this.
  const twelveMonthsAgo = new Date(now.getTime() - 90 * 86_400_000);
  const twelveMonthsAgoStr = toChicagoDateStr(twelveMonthsAgo);

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
    // Worst first
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
  const completedIn12mo = jobs.filter((job) => {
    if (!isCompleted(job)) return false;
    const scheduledStr = job.schedule?.scheduled_start;
    if (!scheduledStr) return false;
    return toChicagoDateStr(new Date(scheduledStr)) >= twelveMonthsAgoStr;
  });

  // Group by customer name
  const customerMap = new Map<
    string,
    { jobs: HcpRevenueJob[]; revenue: number }
  >();
  for (const job of completedIn12mo) {
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
      // HCP doesn't reliably expose payment-received timestamp so we can't
      // compute avg days-to-pay without a second per-job lookup.
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
    revenueInvoiced: weekCompleted.reduce(
      (s, j) => s + getInvoiceTotal(j),
      0,
    ),
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
  };
}

// ---------------------------------------------------------------------------
// Exported server function
// ---------------------------------------------------------------------------

export const fetchRevenueData = createServerFn({ method: "GET" }).handler(
  async (): Promise<RevenueData> => {
    const now = new Date();
    // 90 days keeps the request well inside Cloudflare's 30s wall-clock limit.
    // PM section shows repeat customers within this window instead of 12 months.
    const start = toChicagoDateStr(new Date(now.getTime() - 90 * 86_400_000));
    const end = toChicagoDateStr(now);

    const jobs = await fetchAllJobsInRange(start, end);
    return processRevenueData(jobs);
  },
);
