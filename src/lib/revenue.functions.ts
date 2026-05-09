/**
 * Revenue Intelligence — server-only data fetching.
 * Reads from Supabase hcp_jobs_cache (instant, no HCP API call).
 * raw_data jsonb contains the full HCP response including payment fields.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// HCP response shape (extended with all revenue-relevant fields)
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
  address?: {
    name?: string;   // property/location name e.g. "Target Round Rock"
    notes?: string;  // site label e.g. "Walgreens 09679" — shown below address in HCP UI
    note?: string;
    nickname?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  // Enterprise HCP accounts may have a top-level location object
  location?: {
    name?: string;
    address?: { name?: string; street?: string; city?: string; state?: string };
  };
  description?: string;
  title?: string;
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
  tags?: string[];

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
  siteName: string;        // location/property identifier (address.name or street+city)
  customerName: string;    // parent company name (for reference)
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

export type OpenJob = {
  jobId: string;
  jobNumber: string;
  customerName: string;
  jobType: string | null;
  address: string | null;
  city: string | null;
  locationName: string | null;
  scheduledDate: string | null;
  status: string;
  invoiceValue: number;
};

export type RevenueData = {
  /** All unpaid completed jobs in last 90 days, sorted worst-first. */
  receivables: ReceivableJob[];
  totalAtRisk: number;
  atRiskCount: number;
  avgDaysOverdue: number;
  /** Customers with 3+ completed jobs in last 90 days. */
  pmCandidates: PmCandidate[];
  weeklySnapshot: WeeklySnapshot;
  /** All non-completed, non-cancelled jobs in the 90-day window. */
  openJobs: OpenJob[];
  asOf: string;
  cacheDaysAvailable: number;
};

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key)
    throw new Error("Supabase env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Data extraction helpers
// ---------------------------------------------------------------------------

// MCR's own company names — used to filter out self-referential customer entries
const MCR_NAMES_RE = /modern compactor repair|^mcr$/i;

function isOwnCompany(s: string): boolean {
  return MCR_NAMES_RE.test(s.trim());
}

/**
 * Returns the best human-readable customer/site name for a job.
 * Priority: location.name > address.name > customer company > description site > street+city.
 * Filters out MCR's own company name which HCP returns as company_name on all jobs.
 */
function getCustomerName(job: HcpRevenueJob): string {
  // 1. Enterprise location object
  const locName = job.location?.name ?? job.location?.address?.name;
  if (locName && !isOwnCompany(locName)) return locName;

  // 2. Address-level property name ("Target Round Rock", "Walmart #3421")
  if (job.address?.name && !isOwnCompany(job.address.name)) return job.address.name;

  // 3. Customer company name — skip if it's MCR itself
  if (job.customer?.company_name && !isOwnCompany(job.customer.company_name))
    return job.customer.company_name;

  // 4. Customer full name
  if (job.customer?.name && !isOwnCompany(job.customer.name)) return job.customer.name;
  const full = [job.customer?.first_name, job.customer?.last_name]
    .filter(Boolean).join(" ").trim();
  if (full && !isOwnCompany(full)) return full;

  // 5. Parse description for site name — HCP stores
  //    "WO: 347743438 | Priority: 72 Hours | PO # 107246-01 - 1015 N TOWN EAST BLVD - Walgreen Drug Store # 06390"
  //    The last " - " segment is the real site/chain name.
  const siteName = parseSiteNameFromDescription(job.description);
  if (siteName) return siteName;

  // 6. Street + city as last resort
  const a = job.address;
  if (a?.street && a?.city) return `${a.street}, ${a.city}`;
  if (a?.city) return a.city;

  return "Unknown";
}

function parseSiteNameFromDescription(desc: string | undefined): string | null {
  if (!desc) return null;
  const segments = desc.split(/ - /);
  if (segments.length < 2) return null;
  const last = segments[segments.length - 1].trim();
  if (!last) return null;
  // Skip if it looks like a street address (starts with a house number)
  if (/^\d{2,}\s/.test(last)) return null;
  // Skip if it's a bare PO/WO reference ("PO# 41BCJR", "WO: 347743438")
  if (/^(P\.?O\.?|W\.?O\.?)\s*[#:\s]\s*\S/i.test(last)) return null;
  if (isOwnCompany(last)) return null;
  return last;
}

/**
 * Returns a site-level key for PM candidate grouping.
 * More granular than company name — "Walgreen Drug Store # 06390" groups separately from "# 09679".
 */
function getSiteName(job: HcpRevenueJob): string {
  const locName = job.location?.name ?? job.location?.address?.name;
  if (locName && !isOwnCompany(locName)) return locName;
  if (job.address?.name && !isOwnCompany(job.address.name)) return job.address.name;

  // Use description-parsed site name (e.g. "Walgreen Drug Store # 06390")
  const siteName = parseSiteNameFromDescription(job.description);
  if (siteName) return siteName;

  const a = job.address;
  if (a?.street && a?.city) return `${a.street}, ${a.city}`;
  if (a?.city) {
    const company = job.customer?.company_name;
    if (company && !isOwnCompany(company)) return `${company} — ${a.city}`;
    return a.city;
  }

  return getCustomerName(job);
}

function getJobType(job: HcpRevenueJob): string | null {
  if (job.work_line_items?.[0]?.name) return job.work_line_items[0].name;
  if (job.tags?.[0]) return job.tags[0];
  return null;
}

function getAddressLine(job: HcpRevenueJob): string | null {
  const a = job.address;
  if (!a) return null;
  return [a.street, a.city, a.state].filter(Boolean).join(", ") || null;
}

function getCity(job: HcpRevenueJob): string | null {
  return job.address?.city ?? null;
}

function looksLikeStreetAddress(s: string): boolean {
  return /^\d+\s/.test(s.trim());
}

/**
 * Best human-readable location identifier for the Open Jobs table.
 * Priority: location.name → address.name → address.notes (HCP stores "Walgreens 09679" here)
 * → job_site_name from DB (parsed from service line item, skipped if it looks like a street)
 * → city.
 */
function getLocationName(job: HcpRevenueJob, jobSiteName?: string | null): string | null {
  const locName = job.location?.name ?? job.location?.address?.name;
  if (locName && !isOwnCompany(locName) && !looksLikeStreetAddress(locName)) return locName;

  if (job.address?.name && !isOwnCompany(job.address.name) && !looksLikeStreetAddress(job.address.name))
    return job.address.name;

  // HCP stores site labels (e.g. "Walgreens 09679") in address.notes
  const notes = job.address?.notes ?? job.address?.note ?? job.address?.nickname;
  if (notes?.trim() && !isOwnCompany(notes)) return notes.trim();

  // DB-stored job_site_name (parsed from the service line item last segment)
  if (jobSiteName && !looksLikeStreetAddress(jobSiteName)) return jobSiteName;

  return job.address?.city ?? null;
}

/** HCP returns monetary values in cents — always divide by 100 before display. */
function getInvoiceTotal(job: HcpRevenueJob): number {
  let raw = 0;
  if (typeof job.total_amount === "number" && job.total_amount > 0)
    raw = job.total_amount;
  else if (typeof job.invoice?.total === "number" && job.invoice.total > 0)
    raw = job.invoice.total;
  else if (typeof job.invoice?.subtotal === "number" && job.invoice.subtotal > 0)
    raw = job.invoice.subtotal;
  else if (job.work_line_items?.length) {
    const sum = job.work_line_items.reduce((acc, item) => {
      if (typeof item.total === "number") return acc + item.total;
      return acc + (item.unit_price ?? 0) * (item.quantity ?? 1);
    }, 0);
    raw = sum;
  }
  return raw > 0 ? raw / 100 : 0;
}

function getBalanceDue(job: HcpRevenueJob): number {
  if (typeof job.balance_due === "number") return job.balance_due;
  if (typeof job.invoice?.balance_due === "number") return job.invoice.balance_due;
  if (typeof job.outstanding_balance === "number") return job.outstanding_balance;
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
  const s = (job.work_status ?? "").toLowerCase();
  // HCP uses "complete rated", "complete unrated", "complete", "completed"
  return s === "complete" || s === "completed" || s.startsWith("complete ");
}

function isCancelled(job: HcpRevenueJob): boolean {
  const s = (job.work_status ?? "").toLowerCase();
  return s.includes("cancel");
}

// ---------------------------------------------------------------------------
// Date/timezone helpers
// ---------------------------------------------------------------------------

function toChicagoDateStr(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
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
    timeZone: "America/Chicago", weekday: "short",
  }).format(now);
  const dayIndex: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const todayNum = dayIndex[weekdayStr] ?? 1;
  const daysSinceMon = todayNum === 0 ? 6 : todayNum - 1;
  const monday = new Date(now.getTime() - daysSinceMon * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { weekStart: toChicagoDateStr(monday), weekEnd: toChicagoDateStr(sunday) };
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

function processRevenueData(
  jobs: HcpRevenueJob[],
  cacheDaysAvailable: number,
  jobSiteNames: Map<string, string | null>,
): RevenueData {
  const now = new Date();
  const todayStr = toChicagoDateStr(now);
  const ninetyDaysAgoStr = toChicagoDateStr(new Date(now.getTime() - 90 * 86_400_000));
  const { weekStart, weekEnd } = getCurrentWeekBoundsCDT();

  // ---- Section 1: Receivables ----
  const unpaidCompleted90d = jobs
    .filter((job) => {
      if (!isCompleted(job)) return false;
      if (!isUnpaid(job)) return false;
      const s = job.schedule?.scheduled_start;
      if (!s) return false;
      const d = toChicagoDateStr(new Date(s));
      return d >= ninetyDaysAgoStr && d <= todayStr;
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
      ? Math.round(atRiskJobs.reduce((s, r) => s + r.daysSinceInvoice, 0) / atRiskJobs.length)
      : 0;

  // ---- Section 2: PM Candidates ----
  const completedInWindow = jobs.filter((job) => {
    if (!isCompleted(job)) return false;
    const s = job.schedule?.scheduled_start;
    if (!s) return false;
    return toChicagoDateStr(new Date(s)) >= ninetyDaysAgoStr;
  });

  // Group by SITE (address.name / street+city) so that Synergy-Austin and
  // Synergy-San Antonio appear as separate PM candidates, not one merged entry.
  const customerMap = new Map<
    string,
    { jobs: HcpRevenueJob[]; revenue: number; parentCompany: string }
  >();
  for (const job of completedInWindow) {
    const siteKey = getSiteName(job);
    const entry = customerMap.get(siteKey) ?? {
      jobs: [],
      revenue: 0,
      parentCompany: getCustomerName(job),
    };
    entry.jobs.push(job);
    entry.revenue += getInvoiceTotal(job);
    customerMap.set(siteKey, entry);
  }

  const pmCandidates: PmCandidate[] = Array.from(customerMap.entries())
    .filter(([, e]) => e.jobs.length >= 3)
    .map(([siteKey, e]) => ({
      siteName: siteKey,
      customerName: e.parentCompany,
      totalJobs: e.jobs.length,
      totalRevenue: e.revenue,
      avgDaysToPay: 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---- Section 3: Weekly Snapshot ----
  const weekJobs = jobs.filter((job) => {
    const s = job.schedule?.scheduled_start;
    if (!s) return false;
    const d = toChicagoDateStr(new Date(s));
    return d >= weekStart && d <= weekEnd;
  });

  const weekCompleted = weekJobs.filter(isCompleted);
  const weekOpen = weekJobs.filter((j) => !isCompleted(j) && !isCancelled(j));

  const weeklySnapshot: WeeklySnapshot = {
    jobsCompleted: weekCompleted.length,
    revenueInvoiced: weekCompleted.reduce((s, j) => s + getInvoiceTotal(j), 0),
    revenueCollected: weekCompleted
      .filter((j) => !isUnpaid(j))
      .reduce((s, j) => s + getInvoiceTotal(j), 0),
    jobsOpen: weekOpen.length,
  };

  // ---- Section 4: Open Jobs (all 90-day window) ----
  const openJobs: OpenJob[] = jobs
    .filter((job) => {
      if (isCompleted(job) || isCancelled(job)) return false;
      const s = job.schedule?.scheduled_start;
      if (!s) return false;
      const d = toChicagoDateStr(new Date(s));
      return d >= ninetyDaysAgoStr && d <= todayStr;
    })
    .map((job): OpenJob => ({
      jobId: job.id,
      jobNumber: job.invoice_number ?? job.job_number ?? job.id,
      customerName: getCustomerName(job),
      jobType: getJobType(job),
      address: getAddressLine(job),
      city: getCity(job),
      locationName: getLocationName(job, jobSiteNames.get(job.id)),
      scheduledDate: job.schedule?.scheduled_start
        ? toChicagoDateStr(new Date(job.schedule.scheduled_start))
        : null,
      status: job.work_status ?? "scheduled",
      invoiceValue: getInvoiceTotal(job),
    }))
    .sort((a, b) => (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? ""));

  return {
    receivables: unpaidCompleted90d,
    totalAtRisk,
    atRiskCount: atRiskJobs.length,
    avgDaysOverdue,
    pmCandidates,
    weeklySnapshot,
    openJobs,
    asOf: now.toISOString(),
    cacheDaysAvailable,
  };
}

// ---------------------------------------------------------------------------
// Exported server function
// ---------------------------------------------------------------------------

export const fetchRevenueData = createServerFn({ method: "GET" }).handler(
  async (): Promise<RevenueData> => {
    const supabase = getSupabase();

    const { data: rows, error } = await supabase
      .from("work_orders")
      .select("hcp_id, number, customer_name, hcp_status, scheduled_date, raw_data, job_site_name")
      .order("scheduled_date", { ascending: false });

    if (error) throw new Error(`Supabase error: ${error.message}`);

    const allRows = rows ?? [];

    const jobSiteNames = new Map<string, string | null>();
    const jobs: HcpRevenueJob[] = allRows.map((row) => {
      const raw = (row.raw_data ?? {}) as Record<string, unknown>;
      const hcpId = String(row.hcp_id);
      if (row.job_site_name) jobSiteNames.set(hcpId, row.job_site_name as string);

      // Build a schedule object that always has scheduled_start populated.
      // raw.schedule may exist as an object but have scheduled_start: null (HCP clears
      // it for completed jobs), so we can't just use ?? — we need to fill the gap.
      const rawSchedule = raw.schedule as HcpRevenueJob["schedule"] | undefined;
      const fallbackStart = row.scheduled_date
        ? `${row.scheduled_date}T12:00:00`
        : undefined;
      const schedule: HcpRevenueJob["schedule"] = rawSchedule
        ? { ...rawSchedule, scheduled_start: rawSchedule.scheduled_start ?? fallbackStart }
        : { scheduled_start: fallbackStart };

      // When raw_data.customer.company_name is MCR's own name, replace it with the
      // DB's backfilled customer_name ONLY when that value looks like a real business
      // name (not an address). Address-shaped values (start with house number) fall
      // through to parseSiteNameFromDescription → address fallback inside getCustomerName.
      const rawCustomer = raw.customer as HcpRevenueJob["customer"] | undefined;
      const rawCompany = rawCustomer?.company_name ?? "";
      const dbName = (row.customer_name ?? "") as string;
      const dbNameIsBusinessName = dbName.length > 0 && !/^\d{1,6}\s/.test(dbName.trim());
      const customerForDisplay: HcpRevenueJob["customer"] =
        rawCustomer && !MCR_NAMES_RE.test(rawCompany.trim())
          ? rawCustomer
          : { company_name: dbNameIsBusinessName ? dbName : undefined };

      return {
        ...raw,
        id: hcpId,
        work_status: (raw.work_status as string | undefined) ?? row.hcp_status ?? undefined,
        customer: customerForDisplay,
        schedule,
      } as HcpRevenueJob;
    });

    const dates = allRows.map((r) => r.scheduled_date).filter(Boolean).sort();
    let cacheDaysAvailable = 0;
    if (dates.length > 0) {
      const oldest = new Date(dates[0] + "T00:00:00");
      cacheDaysAvailable = Math.floor((Date.now() - oldest.getTime()) / 86_400_000);
    }

    return processRevenueData(jobs, cacheDaysAvailable, jobSiteNames);
  },
);
