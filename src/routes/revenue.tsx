import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ArrowLeft, AlertTriangle, TrendingUp, CalendarDays, Loader2,
  AlertCircle, RefreshCw, ClipboardList, Search, X, MapPin,
} from "lucide-react";
import { MCRLogo } from "@/components/MCRLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchRevenueData } from "@/lib/revenue.functions";
import type { ReceivableJob, PmCandidate, RevenueData, OpenJob } from "@/lib/revenue.functions";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue Intelligence — MCR Tech Performance Tool" },
      {
        name: "description",
        content: "Live receivables, PM opportunities, and weekly revenue snapshot for Modern Compactor Repair.",
      },
    ],
  }),
  component: RevenuePage,
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function rowColor(days: number): string {
  if (days > 30) return "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500";
  if (days >= 15) return "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500";
  return "bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500";
}

function ageBadge(days: number) {
  if (days > 30)
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-semibold">{days}d</Badge>;
  if (days >= 15)
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 font-semibold">{days}d</Badge>;
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-semibold">{days}d</Badge>;
}

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  unscheduled: "Unscheduled",
  needs_review: "Needs Review",
  complete: "Complete",
  completed: "Complete",
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "in_progress" || s === "working")
    return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">In Progress</Badge>;
  if (s === "unscheduled")
    return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs">Unscheduled</Badge>;
  if (s === "needs_review")
    return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">Needs Review</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">Scheduled</Badge>;
}

// ---------------------------------------------------------------------------
// Shared header
// ---------------------------------------------------------------------------

function RevenueHeader() {
  return (
    <header className="bg-primary text-primary-foreground border-b-4 border-accent">
      <div className="px-6 py-3 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <div className="h-6 w-px bg-primary-foreground/20" />
          <MCRLogo className="h-7" variant="light" />
          <div className="hidden md:block">
            <div className="text-[10px] uppercase tracking-widest text-accent font-bold">
              Modern Compactor Repair
            </div>
            <div className="text-sm font-semibold">Revenue Intelligence</div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-accent font-bold md:hidden">
          Revenue Intel
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type SyncSummary = {
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
  syncedAt: string;
  errors?: string[];
};

function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const openJobsRef = useRef<HTMLElement>(null);

  const loadData = useCallback(() => {
    setError(null);
    fetchRevenueData()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function syncFromHcp() {
    setSyncing(true);
    const toastId = toast.loading("Syncing 90 days of jobs from HouseCall Pro…");
    try {
      const res = await fetch("/api/hcp-revenue-sync?days=90");
      const json = await res.json() as {
        ok?: boolean; fetched?: number; upserted?: number; inserted?: number; updated?: number;
        failed?: number; syncedAt?: string; errors?: string[]; error?: string; detail?: string;
      };
      if (!res.ok || !json.ok) {
        const msg = [json.error, json.detail, ...(json.errors ?? [])].filter(Boolean).join(" — ");
        toast.error(`Sync failed: ${msg || "unknown error"}`, { id: toastId });
        return;
      }
      const totalUpserted = json.upserted ?? ((json.inserted ?? 0) + (json.updated ?? 0));
      setLastSync({
        fetched: json.fetched ?? 0,
        inserted: json.inserted ?? 0,
        updated: json.updated ?? 0,
        failed: json.failed ?? 0,
        syncedAt: json.syncedAt ?? new Date().toISOString(),
        errors: json.errors,
      });
      toast.success(
        `Synced ${json.fetched ?? 0} jobs · ${totalUpserted} upserted${json.failed ? `, ${json.failed} failed` : ""}`,
        { id: toastId },
      );
      setData(null);
      loadData();
    } catch (err) {
      toast.error(`Network error: ${err instanceof Error ? err.message : String(err)}`, { id: toastId });
    } finally {
      setSyncing(false);
    }
  }

  function scrollToOpenJobs() {
    openJobsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RevenueHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-card border border-destructive/30 rounded-xl p-8 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Could not load revenue data</h2>
            <pre className="mt-3 text-left text-xs bg-muted rounded-md p-3 overflow-auto text-destructive max-h-40">{error}</pre>
            <button onClick={loadData} className="mt-6 text-sm text-primary hover:underline">Retry</button>
          </div>
        </main>
      </div>
    );
  }

  // ---- Loading state ----
  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RevenueHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Pulling revenue data…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RevenueHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8">

        {/* ---- Meta row ---- */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {data.cacheDaysAvailable < 30 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Cache has ~{data.cacheDaysAvailable}d of history
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={syncFromHcp}
              disabled={syncing}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync 90d from HCP"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Data as of {asOfLabel(data.asOf)} · HCP cache
          </p>
        </div>

        {/* ---- Last sync summary ---- */}
        {lastSync && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              Last HCP sync
            </span>
            <span className="text-muted-foreground">
              Fetched <span className="font-bold text-foreground tabular-nums">{lastSync.fetched}</span>
            </span>
            <span className="text-green-700">
              Inserted <span className="font-bold tabular-nums">{lastSync.inserted}</span>
            </span>
            <span className="text-blue-700">
              Updated <span className="font-bold tabular-nums">{lastSync.updated}</span>
            </span>
            <span className={lastSync.failed > 0 ? "text-destructive" : "text-muted-foreground"}>
              Failed <span className="font-bold tabular-nums">{lastSync.failed}</span>
            </span>
            <span className="text-muted-foreground ml-auto">
              {asOfLabel(lastSync.syncedAt)}
            </span>
            {lastSync.errors && lastSync.errors.length > 0 && (
              <p className="basis-full text-destructive text-[11px] mt-1">
                {lastSync.errors.join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* ================================================================
            SECTION 1 — Receivables At Risk
        ================================================================ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">
              Receivables At Risk
            </h2>
          </div>

          <Card className="mb-4 border-destructive/30">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-5xl sm:text-6xl font-bold text-destructive tabular-nums">
                    {fmt$(data.totalAtRisk)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">at risk</p>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right space-y-0.5">
                  <p>
                    <span className="font-semibold text-foreground">{data.atRiskCount}</span>{" "}
                    job{data.atRiskCount !== 1 ? "s" : ""} over 15 days
                  </p>
                  {data.atRiskCount > 0 && (
                    <p>
                      avg{" "}
                      <span className="font-semibold text-foreground">{data.avgDaysOverdue}</span>{" "}
                      days overdue
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />&lt;15 days
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" />15–30 days
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />&gt;30 days
                </span>
              </div>
            </CardContent>
          </Card>

          {data.receivables.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No unpaid completed invoices in the last 90 days.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Customer</TableHead>
                    <TableHead className="font-semibold text-foreground">Job #</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Invoice</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Age</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.receivables.map((row: ReceivableJob) => (
                    <TableRow key={row.jobId} className={rowColor(row.daysSinceInvoice)}>
                      <TableCell className="font-medium">{row.customerName}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{row.jobNumber}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.invoiceValue > 0 ? fmt$(row.invoiceValue) : "—"}
                      </TableCell>
                      <TableCell className="text-center">{ageBadge(row.daysSinceInvoice)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs text-muted-foreground">Unpaid</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* ================================================================
            SECTION 2 — PM Opportunity
        ================================================================ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">PM Opportunity</h2>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                {data.pmCandidates.length > 0 ? (
                  <>
                    <span className="text-3xl font-bold text-primary">{data.pmCandidates.length}</span>{" "}
                    client{data.pmCandidates.length !== 1 ? "s are" : " is"} repeat customers
                  </>
                ) : (
                  "No repeat customers found in the last 90 days"
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                3 or more completed jobs in the last 90 days — prime PM contract candidates.
              </p>
            </CardHeader>

            {data.pmCandidates.length > 0 && (
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Site / Location</TableHead>
                        <TableHead className="font-semibold text-foreground hidden sm:table-cell">Company</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Jobs (90d)</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Revenue (90d)</TableHead>
                        <TableHead className="font-semibold text-foreground text-right hidden md:table-cell">Avg Job</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pmCandidates.map((c: PmCandidate) => (
                        <TableRow key={c.siteName} className="hover:bg-muted/30">
                          <TableCell className="font-medium max-w-[200px] truncate">{c.siteName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground hidden sm:table-cell max-w-[150px] truncate">
                            {c.customerName !== c.siteName ? c.customerName : "—"}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-semibold">{c.totalJobs}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {c.totalRevenue > 0 ? fmt$(c.totalRevenue) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground hidden md:table-cell">
                            {c.totalRevenue > 0 ? fmt$(Math.round(c.totalRevenue / c.totalJobs)) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Potential MRR at <span className="font-semibold text-foreground">$325/mo</span> per client:
                  </p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {fmt$(data.pmCandidates.length * 325)}/mo
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </section>

        {/* ================================================================
            SECTION 3 — Weekly Snapshot
        ================================================================ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">Weekly Snapshot</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SnapshotCard label="Jobs Completed" value={String(data.weeklySnapshot.jobsCompleted)} />
            <SnapshotCard
              label="Revenue Invoiced"
              value={fmt$(data.weeklySnapshot.revenueInvoiced)}
              muted={data.weeklySnapshot.revenueInvoiced === 0}
            />
            <SnapshotCard
              label="Revenue Collected"
              value={fmt$(data.weeklySnapshot.revenueCollected)}
              highlight={data.weeklySnapshot.revenueCollected > 0}
              muted={data.weeklySnapshot.revenueCollected === 0}
            />
            {/* Clickable card — scrolls to Open Jobs section */}
            <button
              onClick={scrollToOpenJobs}
              className="text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <div className="pt-5 pb-4 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                  Jobs Still Open
                </p>
                <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${
                  data.weeklySnapshot.jobsOpen > 0 ? "text-destructive" : "text-foreground"
                }`}>
                  {data.weeklySnapshot.jobsOpen}
                </p>
                <p className="text-[10px] text-primary mt-1 font-medium">
                  View all open jobs ↓
                </p>
              </div>
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground text-center">
            Current week (Mon–Sun, America/Chicago). Jobs matched by scheduled start date.
          </p>
        </section>

        {/* ================================================================
            SECTION 4 — Open Jobs (drillable)
        ================================================================ */}
        <section ref={openJobsRef} className="pb-8 scroll-mt-4">
          <OpenJobsSection openJobs={data.openJobs} />
        </section>

      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Open Jobs section — searchable, filterable
// ---------------------------------------------------------------------------

const OPEN_STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Unscheduled", value: "unscheduled" },
] as const;

function OpenJobsSection({ openJobs }: { openJobs: OpenJob[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const term = search.trim().toLowerCase();
  const filtered = openJobs.filter((j) => {
    if (statusFilter !== "all") {
      const s = (j.status ?? "").toLowerCase();
      if (statusFilter === "in_progress" && s !== "in_progress" && s !== "working") return false;
      if (statusFilter === "scheduled" && s !== "scheduled") return false;
      if (statusFilter === "unscheduled" && s !== "unscheduled") return false;
    }
    if (!term) return true;
    return (
      j.customerName.toLowerCase().includes(term) ||
      j.jobNumber.toLowerCase().includes(term) ||
      (j.address ?? "").toLowerCase().includes(term) ||
      (j.city ?? "").toLowerCase().includes(term) ||
      (j.jobType ?? "").toLowerCase().includes(term)
    );
  });

  // Count by status for the filter pills
  const counts = {
    all: openJobs.length,
    scheduled: openJobs.filter((j) => (j.status ?? "").toLowerCase() === "scheduled").length,
    in_progress: openJobs.filter((j) => {
      const s = (j.status ?? "").toLowerCase();
      return s === "in_progress" || s === "working";
    }).length,
    unscheduled: openJobs.filter((j) => (j.status ?? "").toLowerCase() === "unscheduled").length,
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">
            Open Jobs
          </h2>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 font-bold text-sm px-2">
            {openJobs.length}
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">· last 90 days</span>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Customer, job #, city, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {OPEN_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 tabular-nums ${
              statusFilter === f.value ? "text-primary-foreground/80" : "text-muted-foreground"
            }`}>
              {counts[f.value as keyof typeof counts] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {openJobs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No open jobs in the last 90 days. Run a sync to load data from HCP.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No jobs match your filter.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-foreground">Customer</TableHead>
                <TableHead className="font-semibold text-foreground">Job #</TableHead>
                <TableHead className="font-semibold text-foreground hidden md:table-cell">Type</TableHead>
                <TableHead className="font-semibold text-foreground hidden lg:table-cell">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Location</span>
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center">Date</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((job: OpenJob) => (
                <TableRow key={job.jobId} className="hover:bg-muted/30">
                  <TableCell className="font-medium max-w-[180px] truncate">{job.customerName}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                    {job.jobNumber}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell max-w-[140px] truncate">
                    {job.jobType ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                    {job.city ?? job.address ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm whitespace-nowrap">
                    {job.scheduledDate ? fmtDate(job.scheduledDate) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {statusBadge(job.status)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {job.invoiceValue > 0 ? fmt$(job.invoiceValue) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-2.5 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
            <span>Showing {filtered.length} of {openJobs.length} open jobs</span>
            {filtered.length > 0 && (
              <span className="font-semibold text-foreground">
                Total value: {fmt$(filtered.reduce((s, j) => s + j.invoiceValue, 0))}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SnapshotCard
// ---------------------------------------------------------------------------

function SnapshotCard({
  label, value, highlight = false, danger = false, muted = false,
}: {
  label: string; value: string; highlight?: boolean; danger?: boolean; muted?: boolean;
}) {
  const valueClass = danger
    ? "text-destructive"
    : highlight
      ? "text-green-600"
      : muted
        ? "text-muted-foreground"
        : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">{label}</p>
        <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
