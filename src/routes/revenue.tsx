import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, TrendingUp, CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { MCRLogo } from "@/components/MCRLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchRevenueData } from "@/lib/revenue.functions";
import type { ReceivableJob, PmCandidate, RevenueData } from "@/lib/revenue.functions";

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue Intelligence — MCR Tech Performance Tool" },
      {
        name: "description",
        content:
          "Live receivables, PM opportunities, and weekly revenue snapshot for Modern Compactor Repair.",
      },
    ],
  }),
  component: RevenuePage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function rowColor(days: number): string {
  if (days > 30)
    return "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500";
  if (days >= 15)
    return "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500";
  return "bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500";
}

function ageBadge(days: number) {
  if (days > 30)
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-semibold">
        {days}d
      </Badge>
    );
  if (days >= 15)
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 font-semibold">
        {days}d
      </Badge>
    );
  return (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-semibold">
      {days}d
    </Badge>
  );
}

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
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

function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRevenueData()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RevenueHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-card border border-destructive/30 rounded-xl p-8 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Could not load revenue data</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The HouseCall Pro API returned an error. Make sure{" "}
              <code className="font-mono bg-muted px-1 rounded">HCP_API_KEY</code>{" "}
              is set as a Cloudflare Worker secret.
            </p>
            <pre className="mt-3 text-left text-xs bg-muted rounded-md p-3 overflow-auto text-destructive max-h-40">
              {error}
            </pre>
            <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RevenueHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Pulling revenue data from HouseCall Pro…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RevenueHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8">
        {/* Meta row */}
        <p className="text-xs text-muted-foreground text-right">
          Data as of {asOfLabel(data.asOf)} · Source: HouseCall Pro
        </p>

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

          {/* Hero KPI */}
          <Card className="mb-4 border-destructive/30">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-5xl sm:text-6xl font-bold text-destructive tabular-nums">
                    {fmt$(data.totalAtRisk)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    at risk
                  </p>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right space-y-0.5">
                  <p>
                    <span className="font-semibold text-foreground">
                      {data.atRiskCount}
                    </span>{" "}
                    job{data.atRiskCount !== 1 ? "s" : ""} over 15 days
                  </p>
                  {data.atRiskCount > 0 && (
                    <p>
                      avg{" "}
                      <span className="font-semibold text-foreground">
                        {data.avgDaysOverdue}
                      </span>{" "}
                      days overdue
                    </p>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />
                  &lt;15 days
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" />
                  15–30 days
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                  &gt;30 days
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Receivables table */}
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
                    <TableHead className="font-semibold text-foreground text-right">
                      Invoice Value
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-center">
                      Days Since Invoice
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-center">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.receivables.map((row: ReceivableJob) => (
                    <TableRow key={row.jobId} className={rowColor(row.daysSinceInvoice)}>
                      <TableCell className="font-medium">{row.customerName}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {row.jobNumber}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.invoiceValue > 0 ? fmt$(row.invoiceValue) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {ageBadge(row.daysSinceInvoice)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          Unpaid
                        </Badge>
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
            <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">
              PM Opportunity
            </h2>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                {data.pmCandidates.length > 0 ? (
                  <>
                    <span className="text-3xl font-bold text-primary">
                      {data.pmCandidates.length}
                    </span>{" "}
                    client{data.pmCandidates.length !== 1 ? "s are" : " is"} repeat customers
                  </>
                ) : (
                  "No repeat customers found in the last 12 months"
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
                        <TableHead className="font-semibold text-foreground">
                          Customer Name
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-center">
                          Jobs (12 mo)
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-right">
                          Revenue (12 mo)
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-center">
                          Avg Days to Pay
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pmCandidates.map((c: PmCandidate) => (
                        <TableRow key={c.customerName} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{c.customerName}</TableCell>
                          <TableCell className="text-center tabular-nums font-semibold">
                            {c.totalJobs}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {c.totalRevenue > 0 ? fmt$(c.totalRevenue) : "—"}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground text-sm">
                            {c.avgDaysToPay > 0 ? `${c.avgDaysToPay}d` : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* MRR projection */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Potential monthly recurring revenue at{" "}
                    <span className="font-semibold text-foreground">$325/mo</span> per client:
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
        <section className="pb-8">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">
              Weekly Snapshot
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SnapshotCard
              label="Jobs Completed"
              value={String(data.weeklySnapshot.jobsCompleted)}
            />
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
            <SnapshotCard
              label="Jobs Still Open"
              value={String(data.weeklySnapshot.jobsOpen)}
              danger={data.weeklySnapshot.jobsOpen > 0}
            />
          </div>

          <p className="mt-3 text-xs text-muted-foreground text-center">
            Current week (Mon–Sun, America/Chicago). Jobs matched by scheduled start date.
          </p>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SnapshotCard helper
// ---------------------------------------------------------------------------

function SnapshotCard({
  label,
  value,
  highlight = false,
  danger = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
  muted?: boolean;
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
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
          {label}
        </p>
        <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${valueClass}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
