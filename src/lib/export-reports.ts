/**
 * Client-side export utilities for Revenue Intelligence.
 * PDF: analytical executive report with aging buckets, concentration analysis, insights.
 * Excel: 5-sheet workbook with pivot-style analysis beyond what the screen shows.
 *
 * Both functions run entirely in the browser — no server call needed.
 * jsPDF and jspdf-autotable are loaded via dynamic import to avoid SSR issues.
 */
import type { RevenueData, ReceivableJob, PmCandidate } from "./revenue.functions";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// Shared formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDateStr(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis helpers — the "added value" beyond raw data
// ─────────────────────────────────────────────────────────────────────────────

type AgingBucket = {
  label: string;
  count: number;
  value: number;
  pct: string;
  action: string;
};

function buildAgingBuckets(receivables: ReceivableJob[]): AgingBucket[] {
  const total = receivables.reduce((s, r) => s + r.invoiceValue, 0);
  const defs = [
    { label: "0–15 days", min: 0, max: 15, action: "MONITOR — standard follow-up" },
    { label: "15–30 days", min: 15, max: 30, action: "FOLLOW UP — send reminder now" },
    { label: "30+ days", min: 30, max: Infinity, action: "ESCALATE — call immediately" },
  ];
  return defs.map(({ label, min, max, action }) => {
    const items = receivables.filter(
      (r) => r.daysSinceInvoice > min && r.daysSinceInvoice <= max,
    );
    const value = items.reduce((s, r) => s + r.invoiceValue, 0);
    return {
      label,
      count: items.length,
      value,
      pct: total > 0 ? ((value / total) * 100).toFixed(1) + "%" : "0%",
      action,
    };
  });
}

type CustomerConcentration = {
  customerName: string;
  totalOwed: number;
  jobCount: number;
  pctOfPortfolio: string;
  worstBucket: string;
};

function buildCustomerConcentration(
  receivables: ReceivableJob[],
  top = 5,
): CustomerConcentration[] {
  const totalPortfolio = receivables.reduce((s, r) => s + r.invoiceValue, 0);
  const map = new Map<string, { value: number; count: number; worstDays: number }>();
  for (const r of receivables) {
    const entry = map.get(r.customerName) ?? { value: 0, count: 0, worstDays: 0 };
    entry.value += r.invoiceValue;
    entry.count += 1;
    entry.worstDays = Math.max(entry.worstDays, r.daysSinceInvoice);
    map.set(r.customerName, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, top)
    .map(([name, e]) => ({
      customerName: name,
      totalOwed: e.value,
      jobCount: e.count,
      pctOfPortfolio:
        totalPortfolio > 0
          ? ((e.value / totalPortfolio) * 100).toFixed(1) + "%"
          : "0%",
      worstBucket:
        e.worstDays > 30 ? "30+ days" : e.worstDays > 15 ? "15–30 days" : "0–15 days",
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function exportRevenueExcel(data: RevenueData): void {
  const wb = XLSX.utils.book_new();
  const asOf = new Date(data.asOf).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const agingBuckets = buildAgingBuckets(data.receivables);
  const concentration = buildCustomerConcentration(data.receivables);
  const mrrPotential = data.pmCandidates.length * 325;
  const totalReceivables = data.receivables.reduce((s, r) => s + r.invoiceValue, 0);
  const collectEfficiency =
    data.weeklySnapshot.revenueInvoiced > 0
      ? (data.weeklySnapshot.revenueCollected / data.weeklySnapshot.revenueInvoiced) * 100
      : 0;
  const top3Value = concentration.slice(0, 3).reduce((s, c) => s + c.totalOwed, 0);
  const top3Pct =
    totalReceivables > 0
      ? ((top3Value / totalReceivables) * 100).toFixed(0)
      : "0";

  // ── Sheet 1: Executive Summary ────────────────────────────────────────────
  const summaryRows: unknown[][] = [
    ["MCR Revenue Intelligence — Executive Summary"],
    [`As of: ${asOf}`, "", "", "Confidential — Internal Use Only"],
    [],
    ["── KEY METRICS ──"],
    ["Receivables At Risk (>15d)", totalReceivables, "", "Total unpaid, all ages"],
    ["  → High Risk (>30d)", agingBuckets[2].value, "", "Requires immediate escalation"],
    ["  → Medium Risk (15–30d)", agingBuckets[1].value, "", "Needs follow-up reminder"],
    ["Jobs at Risk", data.atRiskCount],
    ["Avg Days Overdue", data.avgDaysOverdue],
    [],
    ["── WEEKLY SNAPSHOT (Current Week) ──"],
    ["Jobs Completed", data.weeklySnapshot.jobsCompleted],
    ["Revenue Invoiced", data.weeklySnapshot.revenueInvoiced],
    ["Revenue Collected", data.weeklySnapshot.revenueCollected],
    [
      "Collection Efficiency",
      collectEfficiency / 100,
      "",
      "Collected ÷ Invoiced this week",
    ],
    ["Jobs Still Open This Week", data.weeklySnapshot.jobsOpen],
    [],
    ["── PM OPPORTUNITY ──"],
    ["PM Candidates (≥3 jobs/90d)", data.pmCandidates.length],
    ["Monthly Recurring Revenue @ $325", mrrPotential],
    ["Annual Contract Value Potential", mrrPotential * 12],
    [],
    ["── AGING BUCKET ANALYSIS ──"],
    ["Bucket", "Count", "Total Value ($)", "% of Receivables", "Recommended Action"],
    ...agingBuckets.map((b) => [b.label, b.count, b.value, b.pct, b.action]),
    [
      "TOTAL",
      data.receivables.length,
      totalReceivables,
      "100%",
      "",
    ],
    [],
    ["── CUSTOMER CONCENTRATION (Top 5) ──"],
    ["Customer", "Total Owed ($)", "Jobs", "% of Portfolio", "Worst Aging Bucket"],
    ...concentration.map((c) => [
      c.customerName,
      c.totalOwed,
      c.jobCount,
      c.pctOfPortfolio,
      c.worstBucket,
    ]),
    [],
    ["── KEY INSIGHTS ──"],
    [
      `Top 3 customers represent ${top3Pct}% of receivables (${fmt$(top3Value)} of ${fmt$(totalReceivables)}).`,
    ],
    [
      `${agingBuckets[2].count} jobs (${agingBuckets[2].pct}) are 30+ days overdue — ${fmt$(agingBuckets[2].value)} at highest collection risk.`,
    ],
    [
      `PM program at $325/mo could generate ${fmt$(mrrPotential)}/mo | ${fmt$(mrrPotential * 12)}/yr in recurring revenue.`,
    ],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [
    { wch: 38 },
    { wch: 20 },
    { wch: 6 },
    { wch: 48 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Executive Summary");

  // ── Sheet 2: Receivables Aging ────────────────────────────────────────────
  const recHeader = [
    "Customer",
    "Job #",
    "Invoice Value ($)",
    "Days Since Invoice",
    "Age Bucket",
    "Risk Level",
  ];
  const recRows = data.receivables.map((r) => {
    const bucket =
      r.daysSinceInvoice > 30
        ? "30+ days"
        : r.daysSinceInvoice > 15
          ? "15–30 days"
          : "0–15 days";
    const risk =
      r.daysSinceInvoice > 30 ? "HIGH" : r.daysSinceInvoice > 15 ? "MEDIUM" : "LOW";
    return [r.customerName, r.jobNumber, r.invoiceValue, r.daysSinceInvoice, bucket, risk];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([recHeader, ...recRows]);
  ws2["!cols"] = [
    { wch: 34 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Receivables Aging");

  // ── Sheet 3: PM Opportunities ─────────────────────────────────────────────
  const PM_MONTHLY = 325;
  const pmHeader = [
    "Site / Location",
    "Company",
    "Jobs (90d)",
    "Revenue (90d) ($)",
    "Avg Job Value ($)",
    "Monthly PM @ $325",
    "Annual Contract Value ($)",
  ];
  const pmRows = data.pmCandidates.map((c: PmCandidate) => [
    c.siteName,
    c.customerName !== c.siteName ? c.customerName : "",
    c.totalJobs,
    c.totalRevenue,
    c.totalRevenue > 0 ? Math.round(c.totalRevenue / c.totalJobs) : 0,
    PM_MONTHLY,
    PM_MONTHLY * 12,
  ]);
  const pmTotals = [
    `TOTAL (${data.pmCandidates.length} clients)`,
    "",
    data.pmCandidates.reduce((s, c) => s + c.totalJobs, 0),
    data.pmCandidates.reduce((s, c) => s + c.totalRevenue, 0),
    "",
    mrrPotential,
    mrrPotential * 12,
  ];
  const ws3 = XLSX.utils.aoa_to_sheet([pmHeader, ...pmRows, [], pmTotals]);
  ws3["!cols"] = [
    { wch: 34 },
    { wch: 26 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "PM Opportunities");

  // ── Sheet 4: Open Jobs ────────────────────────────────────────────────────
  const ojHeader = [
    "Customer",
    "Job #",
    "Job Type",
    "City",
    "Scheduled Date",
    "Status",
    "Invoice Value ($)",
  ];
  const statusPriority = ["in_progress", "working", "scheduled", "unscheduled", "needs_review"];
  const sortedOpen = [...data.openJobs].sort(
    (a, b) =>
      statusPriority.indexOf(a.status.toLowerCase()) -
      statusPriority.indexOf(b.status.toLowerCase()),
  );
  const ojRows = sortedOpen.map((j) => [
    j.customerName,
    j.jobNumber,
    j.jobType ?? "—",
    j.city ?? "—",
    j.scheduledDate ? fmtDateStr(j.scheduledDate) : "—",
    j.status,
    j.invoiceValue,
  ]);
  const ojTotalValue = data.openJobs.reduce((s, j) => s + j.invoiceValue, 0);
  const ojTotals = [
    `TOTAL (${data.openJobs.length} jobs)`,
    "",
    "",
    "",
    "",
    "",
    ojTotalValue,
  ];
  const ws4 = XLSX.utils.aoa_to_sheet([ojHeader, ...ojRows, [], ojTotals]);
  ws4["!cols"] = [
    { wch: 32 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, "Open Jobs");

  // ── Sheet 5: Aging Analysis (pivot-style) ─────────────────────────────────
  const agingAnalysisRows: unknown[][] = [
    ["MCR Receivables — Aging Portfolio Analysis"],
    [`As of: ${asOf}`],
    [],
    ["PORTFOLIO BREAKDOWN BY AGING BUCKET"],
    ["Bucket", "Job Count", "Total Value ($)", "% of Portfolio", "Action"],
    ...agingBuckets.map((b) => [b.label, b.count, b.value, b.pct, b.action]),
    ["TOTAL", data.receivables.length, totalReceivables, "100%", ""],
    [],
    ["CUSTOMER RISK CONCENTRATION (Top 5 Exposures)"],
    ["Customer", "Total Owed ($)", "Jobs", "% of Portfolio", "Worst Aging"],
    ...concentration.map((c) => [
      c.customerName,
      c.totalOwed,
      c.jobCount,
      c.pctOfPortfolio,
      c.worstBucket,
    ]),
    [],
    ["RISK HEAT MAP — value by bucket"],
    ["", "Job Count", "Total Value", "Avg Value per Job"],
    ...agingBuckets.map((b) => [
      b.label,
      b.count,
      b.value,
      b.count > 0 ? Math.round(b.value / b.count) : 0,
    ]),
    [],
    ["INSIGHTS"],
    [
      `Top 3 customers = ${top3Pct}% of receivables (${fmt$(top3Value)} of ${fmt$(totalReceivables)}).`,
    ],
    [
      `30+ day bucket: ${agingBuckets[2].count} jobs, ${fmt$(agingBuckets[2].value)} — highest write-off risk.`,
    ],
    [
      `If you collect all 30+ day jobs, you recover ${fmt$(agingBuckets[2].value)} — focus collections here first.`,
    ],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(agingAnalysisRows);
  ws5["!cols"] = [
    { wch: 36 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 42 },
  ];
  XLSX.utils.book_append_sheet(wb, ws5, "Aging Analysis");

  // ── Save ──────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `MCR_Revenue_Intelligence_${today}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT — executive-grade analytical report
// Dynamic import to avoid SSR execution (jsPDF is browser-only)
// ─────────────────────────────────────────────────────────────────────────────

type JsPDFWithAutoTable = {
  lastAutoTable: { finalY: number };
};

export async function exportRevenuePDF(data: RevenueData): Promise<void> {
  // Dynamic imports — only runs in browser context
  const [jspdfModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // Support both named export (v4) and default export (v2/v3)
  const JsPDF =
    "jsPDF" in jspdfModule
      ? (jspdfModule as unknown as { jsPDF: new (...a: unknown[]) => unknown }).jsPDF
      : (jspdfModule as unknown as { default: new (...a: unknown[]) => unknown }).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable: (doc: unknown, options: Record<string, unknown>) => void =
    "default" in autoTableModule
      ? (autoTableModule.default as (doc: unknown, options: Record<string, unknown>) => void)
      : (autoTableModule as unknown as (doc: unknown, options: Record<string, unknown>) => void);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new (JsPDF as any)({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  }) as {
    addPage: () => void;
    setPage: (n: number) => void;
    getNumberOfPages: () => number;
    setFillColor: (r: number, g: number, b: number) => void;
    setDrawColor: (r: number, g: number, b: number) => void;
    setTextColor: (r: number, g: number, b: number) => void;
    setFontSize: (s: number) => void;
    setFont: (name: string, style: string) => void;
    rect: (x: number, y: number, w: number, h: number, style: string) => void;
    roundedRect: (
      x: number,
      y: number,
      w: number,
      h: number,
      rx: number,
      ry: number,
      style: string,
    ) => void;
    circle: (x: number, y: number, r: number, style: string) => void;
    text: (
      text: string | string[],
      x: number,
      y: number,
      opts?: Record<string, unknown>,
    ) => void;
    splitTextToSize: (text: string, maxWidth: number) => string[];
    line: (x1: number, y1: number, x2: number, y2: number) => void;
    save: (filename: string) => void;
  } & JsPDFWithAutoTable;

  const PAGE_W = 215.9;
  const MARGIN = 14;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 0;

  function getLastTableY(): number {
    return doc.lastAutoTable?.finalY ?? y;
  }

  function checkPage(needed = 20) {
    if (y + needed > 268) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function sectionHeader(title: string) {
    checkPage(14);
    doc.setFillColor(26, 26, 26);
    doc.rect(MARGIN, y, CONTENT_W, 8, "F");
    doc.setFillColor(245, 166, 35);
    doc.rect(MARGIN, y + 8, CONTENT_W, 1, "F");
    doc.setTextColor(245, 166, 35);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), MARGIN + 3, y + 5.5);
    doc.setTextColor(26, 26, 26);
    y += 12;
  }

  function kpiCard(
    x: number,
    yPos: number,
    w: number,
    h: number,
    label: string,
    value: string,
    valueRgb: [number, number, number] = [26, 26, 26],
  ) {
    doc.setFillColor(247, 247, 247);
    doc.roundedRect(x, yPos, w, h, 2, 2, "F");
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(x, yPos, w, h, 2, 2, "S");
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + w / 2, yPos + 5, { align: "center" });
    doc.setTextColor(valueRgb[0], valueRgb[1], valueRgb[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + w / 2, yPos + 13, { align: "center" });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pre-compute analytics
  // ─────────────────────────────────────────────────────────────────────────

  const agingBuckets = buildAgingBuckets(data.receivables);
  const concentration = buildCustomerConcentration(data.receivables);
  const mrrPotential = data.pmCandidates.length * 325;
  const totalReceivables = data.receivables.reduce((s, r) => s + r.invoiceValue, 0);
  const collectEfficiency =
    data.weeklySnapshot.revenueInvoiced > 0
      ? Math.round(
          (data.weeklySnapshot.revenueCollected / data.weeklySnapshot.revenueInvoiced) *
            100,
        )
      : 0;
  const top3Value = concentration.slice(0, 3).reduce((s, c) => s + c.totalOwed, 0);
  const top3Pct =
    totalReceivables > 0
      ? ((top3Value / totalReceivables) * 100).toFixed(0)
      : "0";

  // ─────────────────────────────────────────────────────────────────────────
  // Header band
  // ─────────────────────────────────────────────────────────────────────────

  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setFillColor(245, 166, 35);
  doc.rect(0, 26, PAGE_W, 1.5, "F");

  doc.setTextColor(245, 166, 35);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("MODERN COMPACTOR REPAIR · AUSTIN, TX", MARGIN, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Revenue Intelligence Report", MARGIN, 20);

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const asOfStr = new Date(data.asOf).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  doc.text(
    `Generated: ${asOfStr}   |   Confidential — Internal Use Only`,
    MARGIN,
    24.5,
  );

  y = 32;

  // ─────────────────────────────────────────────────────────────────────────
  // KPI grid (2 rows × 3 columns)
  // ─────────────────────────────────────────────────────────────────────────

  const kpiW = (CONTENT_W - 6) / 3;
  const kpiH = 17;
  const kpiGap = 3;

  kpiCard(MARGIN, y, kpiW, kpiH, "Receivables at Risk", fmt$(data.totalAtRisk), [
    200, 30, 30,
  ]);
  kpiCard(MARGIN + kpiW + kpiGap, y, kpiW, kpiH, "Jobs at Risk", String(data.atRiskCount), [
    200, 30, 30,
  ]);
  kpiCard(
    MARGIN + (kpiW + kpiGap) * 2,
    y,
    kpiW,
    kpiH,
    "Avg Days Overdue",
    `${data.avgDaysOverdue}d`,
    [210, 110, 20],
  );

  y += kpiH + kpiGap;

  kpiCard(MARGIN, y, kpiW, kpiH, "PM Candidates", String(data.pmCandidates.length), [
    20, 110, 190,
  ]);
  kpiCard(
    MARGIN + kpiW + kpiGap,
    y,
    kpiW,
    kpiH,
    "MRR Potential",
    fmt$(mrrPotential),
    [22, 150, 70],
  );
  kpiCard(
    MARGIN + (kpiW + kpiGap) * 2,
    y,
    kpiW,
    kpiH,
    "Week Collection %",
    `${collectEfficiency}%`,
    collectEfficiency >= 50 ? [22, 150, 70] : [210, 110, 20],
  );

  y += kpiH + 6;

  // ─────────────────────────────────────────────────────────────────────────
  // Key Findings
  // ─────────────────────────────────────────────────────────────────────────

  sectionHeader("Key Findings & Recommended Actions");

  const findings = [
    {
      text: `Top 3 customers account for ${top3Pct}% of receivables (${fmt$(top3Value)} of ${fmt$(totalReceivables)} total exposure). Concentrated risk — prioritize collections from these accounts first.`,
      urgent: Number(top3Pct) > 50,
    },
    {
      text: `${agingBuckets[2].count} jobs (${agingBuckets[2].pct}) are 30+ days overdue — ${fmt$(agingBuckets[2].value)} at highest write-off risk. Immediate escalation calls recommended.`,
      urgent: agingBuckets[2].count > 0,
    },
    {
      text: `${data.pmCandidates.length} PM contract candidates identified. At $325/mo per contract, MRR potential = ${fmt$(mrrPotential)} | Annual = ${fmt$(mrrPotential * 12)}.`,
      urgent: false,
    },
    {
      text: `Weekly: ${data.weeklySnapshot.jobsCompleted} jobs completed, ${fmt$(data.weeklySnapshot.revenueInvoiced)} invoiced, ${fmt$(data.weeklySnapshot.revenueCollected)} collected (${collectEfficiency}% efficiency). ${data.weeklySnapshot.jobsOpen} jobs still open.`,
      urgent: false,
    },
  ];

  for (const f of findings) {
    const lines = doc.splitTextToSize(f.text, CONTENT_W - 9);
    checkPage(lines.length * 5 + 5);
    // Dot indicator
    doc.setFillColor(f.urgent ? 200 : 245, f.urgent ? 30 : 166, f.urgent ? 30 : 35);
    doc.circle(MARGIN + 2.5, y + 1.8, 1.4, "F");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(8);
    doc.setFont("helvetica", f.urgent ? "bold" : "normal");
    doc.text(lines, MARGIN + 7, y + 3.5);
    y += lines.length * 5 + 3;
  }

  y += 3;

  // ─────────────────────────────────────────────────────────────────────────
  // Receivables — Aging Bucket Summary
  // ─────────────────────────────────────────────────────────────────────────

  sectionHeader("Receivables at Risk — Aging Analysis");

  autoTable(doc, {
    startY: y,
    head: [["Bucket", "Jobs", "Total Value", "% of Portfolio", "Action"]],
    body: [
      ...agingBuckets.map((b) => [b.label, b.count, fmt$(b.value), b.pct, b.action]),
      ["TOTAL", data.receivables.length, fmt$(totalReceivables), "100%", ""],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: {
      fillColor: [26, 26, 26],
      textColor: [245, 166, 35],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 28 },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "center", cellWidth: 26 },
      4: { cellWidth: 70 },
    },
    didParseCell: (hookData: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown>; raw: unknown };
      table: { body: unknown[] };
    }) => {
      if (
        hookData.section === "body" &&
        hookData.row.index === hookData.table.body.length - 1
      ) {
        hookData.cell.styles["fontStyle"] = "bold";
        hookData.cell.styles["fillColor"] = [240, 240, 240];
      }
      // Color the bucket rows
      if (hookData.section === "body" && hookData.column.index === 0) {
        const raw = String(hookData.cell.raw ?? "");
        if (raw.startsWith("30+"))
          hookData.cell.styles["textColor"] = [200, 30, 30];
        else if (raw.startsWith("15"))
          hookData.cell.styles["textColor"] = [210, 110, 20];
        else if (raw.startsWith("0"))
          hookData.cell.styles["textColor"] = [22, 150, 70];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = getLastTableY() + 5;

  // Full receivables table (if there are any)
  if (data.receivables.length > 0) {
    checkPage(20);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.text("Complete unpaid invoice list — sorted by age (worst first)", MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Customer", "Job #", "Invoice ($)", "Days", "Risk"]],
      body: data.receivables.map((r) => {
        const risk =
          r.daysSinceInvoice > 30
            ? "HIGH"
            : r.daysSinceInvoice > 15
              ? "MED"
              : "LOW";
        return [
          r.customerName,
          r.jobNumber,
          fmt$(r.invoiceValue),
          String(r.daysSinceInvoice),
          risk,
        ];
      }),
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 65 },
        2: { halign: "right", cellWidth: 26 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 14, fontStyle: "bold" },
      },
      didParseCell: (hookData: {
        section: string;
        column: { index: number };
        cell: { styles: Record<string, unknown>; raw: unknown };
      }) => {
        if (hookData.section !== "body") return;
        if (hookData.column.index === 4) {
          const v = String(hookData.cell.raw ?? "");
          if (v === "HIGH") hookData.cell.styles["textColor"] = [200, 30, 30];
          else if (v === "MED") hookData.cell.styles["textColor"] = [210, 110, 20];
          else hookData.cell.styles["textColor"] = [22, 150, 70];
        }
        if (hookData.column.index === 3) {
          const days = parseInt(String(hookData.cell.raw ?? "0"), 10);
          if (days > 30) hookData.cell.styles["fillColor"] = [254, 226, 226];
          else if (days > 15) hookData.cell.styles["fillColor"] = [254, 243, 199];
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY() + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PM Opportunity
  // ─────────────────────────────────────────────────────────────────────────

  checkPage(30);
  sectionHeader("PM Opportunity — Contract Pipeline");

  if (data.pmCandidates.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [
        [
          "Site / Location",
          "Co.",
          "Jobs\n(90d)",
          "Revenue\n(90d)",
          "Avg Job",
          "Monthly\n@ $325",
          "Annual\nValue",
        ],
      ],
      body: [
        ...data.pmCandidates.map((c: PmCandidate) => [
          c.siteName,
          c.customerName !== c.siteName ? c.customerName : "—",
          String(c.totalJobs),
          c.totalRevenue > 0 ? fmt$(c.totalRevenue) : "—",
          c.totalRevenue > 0 ? fmt$(Math.round(c.totalRevenue / c.totalJobs)) : "—",
          "$325",
          "$3,900",
        ]),
        [
          `TOTAL — ${data.pmCandidates.length} clients`,
          "",
          String(data.pmCandidates.reduce((s, c) => s + c.totalJobs, 0)),
          fmt$(data.pmCandidates.reduce((s, c) => s + c.totalRevenue, 0)),
          "",
          fmt$(mrrPotential) + "/mo",
          fmt$(mrrPotential * 12) + "/yr",
        ],
      ],
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: {
        fillColor: [26, 26, 26],
        textColor: [245, 166, 35],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 34 },
        2: { halign: "center", cellWidth: 14 },
        3: { halign: "right", cellWidth: 24 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 20 },
        6: { halign: "right", cellWidth: 20 },
      },
      didParseCell: (hookData: {
        section: string;
        row: { index: number };
        cell: { styles: Record<string, unknown> };
        table: { body: unknown[] };
      }) => {
        if (
          hookData.section === "body" &&
          hookData.row.index === hookData.table.body.length - 1
        ) {
          hookData.cell.styles["fontStyle"] = "bold";
          hookData.cell.styles["fillColor"] = [245, 166, 35];
          hookData.cell.styles["textColor"] = [26, 26, 26];
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY() + 6;
  } else {
    checkPage(10);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    doc.text("No PM candidates found in the last 90 days.", MARGIN, y + 5);
    y += 12;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Weekly Snapshot
  // ─────────────────────────────────────────────────────────────────────────

  checkPage(30);
  sectionHeader("Weekly Snapshot (Current Week, Mon–Sun CDT)");

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Jobs Completed",
        "Revenue Invoiced",
        "Revenue Collected",
        "Collection Efficiency",
        "Jobs Still Open",
      ],
    ],
    body: [
      [
        String(data.weeklySnapshot.jobsCompleted),
        fmt$(data.weeklySnapshot.revenueInvoiced),
        fmt$(data.weeklySnapshot.revenueCollected),
        `${collectEfficiency}%`,
        String(data.weeklySnapshot.jobsOpen),
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 4,
      halign: "center",
      fontStyle: "bold",
    },
    headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontSize: 8 },
    didParseCell: (hookData: {
      section: string;
      column: { index: number };
      cell: { styles: Record<string, unknown>; raw: unknown };
    }) => {
      if (hookData.section !== "body") return;
      if (hookData.column.index === 2 && Number(data.weeklySnapshot.revenueCollected) > 0)
        hookData.cell.styles["textColor"] = [22, 150, 70];
      if (hookData.column.index === 4 && Number(data.weeklySnapshot.jobsOpen) > 0)
        hookData.cell.styles["textColor"] = [200, 30, 30];
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = getLastTableY() + 6;

  // ─────────────────────────────────────────────────────────────────────────
  // Open Jobs Pipeline
  // ─────────────────────────────────────────────────────────────────────────

  if (data.openJobs.length > 0) {
    checkPage(30);
    sectionHeader("Open Jobs Pipeline (Last 90 Days)");

    const statusGroups: Record<string, typeof data.openJobs> = {
      "In Progress": data.openJobs.filter((j) =>
        ["in_progress", "working"].includes(j.status.toLowerCase()),
      ),
      Scheduled: data.openJobs.filter((j) => j.status.toLowerCase() === "scheduled"),
      Unscheduled: data.openJobs.filter((j) => j.status.toLowerCase() === "unscheduled"),
      Other: data.openJobs.filter(
        (j) =>
          !["in_progress", "working", "scheduled", "unscheduled"].includes(
            j.status.toLowerCase(),
          ),
      ),
    };

    const statusBody = Object.entries(statusGroups)
      .filter(([, jobs]) => jobs.length > 0)
      .map(([status, jobs]) => {
        const tv = jobs.reduce((s, j) => s + j.invoiceValue, 0);
        return [
          status,
          String(jobs.length),
          fmt$(tv),
          jobs.length > 0 ? fmt$(Math.round(tv / jobs.length)) : "—",
        ];
      });

    statusBody.push([
      "TOTAL",
      String(data.openJobs.length),
      fmt$(data.openJobs.reduce((s, j) => s + j.invoiceValue, 0)),
      "",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Status", "Jobs", "Total Value", "Avg Value / Job"]],
      body: statusBody,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: {
        fillColor: [26, 26, 26],
        textColor: [245, 166, 35],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 40 },
        1: { halign: "center", cellWidth: 18 },
        2: { halign: "right", cellWidth: 36 },
        3: { halign: "right", cellWidth: 36 },
      },
      didParseCell: (hookData: {
        section: string;
        row: { index: number };
        cell: { styles: Record<string, unknown> };
        table: { body: unknown[] };
      }) => {
        if (
          hookData.section === "body" &&
          hookData.row.index === hookData.table.body.length - 1
        ) {
          hookData.cell.styles["fontStyle"] = "bold";
          hookData.cell.styles["fillColor"] = [240, 240, 240];
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = getLastTableY() + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Footer on every page
  // ─────────────────────────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 275, PAGE_W, 12, "F");
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Modern Compactor Repair · Austin, TX · Confidential — Internal Use Only",
      MARGIN,
      280,
    );
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, 280, { align: "right" });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`MCR_Revenue_Intelligence_${today}.pdf`);
}
