import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, PauseLog, TimeEntry } from "@/lib/types";
import {
  fmtDuration,
  fmtDateShort,
  fmtDow,
  aggregateByTech,
  aggregateByJobType,
  aggregateByDay,
  techDayMatrix,
  utilizationBand,
  applyFilters,
  getWorkdays,
  workedMinutes,
} from "@/lib/reports";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "@/components/reports/KpiCard";
import { UtilizationBar } from "@/components/reports/UtilizationBar";
import { UtilizationGauge } from "@/components/reports/UtilizationGauge";
import { UtilizationHeatmap } from "@/components/reports/UtilizationHeatmap";
import { JobTypeDonut } from "@/components/reports/JobTypeDonut";
import { DayTimeline } from "@/components/reports/DayTimeline";
import { TechnicianDrillSheet } from "@/components/reports/TechnicianDrillSheet";
import { ReportFilters } from "@/components/reports/ReportFilters";

const JOB_TYPES = [
  { id: "Service Call / Repair", label: "Service Call / Repair" },
  { id: "Yard Work", label: "Yard Work" },
  { id: "Installation / Removal", label: "Installation / Removal" },
];

export function ReportsTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [vizType, setVizType] = useState<"bars" | "gauges" | "heatmap">(
    "bars"
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [pauses, setPauses] = useState<PauseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ techs: [] as string[], jobTypes: [] as string[] });
  const [drillTech, setDrillTech] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [empRes, entRes] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase
        .from("time_entries")
        .select("*")
        .gte("clock_in", new Date(from).toISOString())
        .lte("clock_in", new Date(to + "T23:59:59").toISOString()),
    ]);

    if (empRes.error || entRes.error) {
      toast.error("Failed to load reports");
      setLoading(false);
      return;
    }

    const emps = (empRes.data ?? []) as Employee[];
    const ents = (entRes.data ?? []) as TimeEntry[];

    const ids = ents.map((e) => e.id);
    let pauseData: PauseLog[] = [];
    if (ids.length > 0) {
      const { data: p } = await supabase
        .from("pause_logs")
        .select("*")
        .in("time_entry_id", ids);
      pauseData = (p ?? []) as PauseLog[];
    }

    setEmployees(emps);
    setEntries(ents);
    setPauses(pauseData);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Apply filters
  const filteredEntries = useMemo(
    () => applyFilters(entries, filters.techs, filters.jobTypes),
    [entries, filters]
  );

  // Aggregations
  const byTech = useMemo(
    () => aggregateByTech(filteredEntries, pauses, employees),
    [filteredEntries, pauses, employees]
  );

  const byJobType = useMemo(
    () => aggregateByJobType(filteredEntries, pauses, JOB_TYPES),
    [filteredEntries, pauses]
  );

  const byDay = useMemo(
    () => aggregateByDay(filteredEntries, pauses),
    [filteredEntries, pauses]
  );

  const workdayRange = useMemo(() => {
    const start = new Date(from);
    const end = new Date(to);
    return getWorkdays(start, end);
  }, [from, to]);

  const matrix = useMemo(
    () => techDayMatrix(filteredEntries, pauses, employees, workdayRange),
    [filteredEntries, pauses, employees, workdayRange]
  );

  // KPI calculations
  const totalMinutes = byTech.reduce((s, t) => s + t.minutes, 0);
  const activeTechs = byTech.filter((t) => t.daysWorked > 0).length;
  const crewUtilization =
    activeTechs > 0
      ? byTech
          .filter((t) => t.daysWorked > 0)
          .reduce((s, t) => s + t.utilization, 0) / activeTechs
      : 0;

  const activeTech =
    drillTech && byTech ? byTech.find((t) => t.id === drillTech) : null;

  // Today's date for timeline
  const today = new Date();

  // Export handlers
  async function handleExportPDF() {
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      exportToPDF({
        dateRange: { from, to },
        crewUtilization,
        activeTechs,
        jobsCompleted: filteredEntries.length,
        totalToday: fmtDuration(
          filteredEntries
            .filter(
              (e) =>
                new Date(e.clock_in).toISOString().slice(0, 10) ===
                today.toISOString().slice(0, 10)
            )
            .reduce((s, e) => s + workedMinutes(e, pauses), 0)
        ),
        totalWeek: fmtDuration(totalMinutes),
        totalMonth: fmtDuration(totalMinutes),
        avgPerTechPerDay: fmtDuration(totalMinutes / Math.max(1, byDay.length)),
        hoursByTech: byTech.map((t) => ({
          name: t.name,
          hours: +(t.minutes / 60).toFixed(2),
          utilization: t.utilization,
        })),
        hoursByType: byJobType.map((j) => ({
          name: j.label,
          hours: +(j.minutes / 60).toFixed(2),
        })),
        dailyRows: byDay.map((r) => ({
          date: fmtDateShort(r.day),
          tech: r.techCount.toString(),
          jobs: r.jobs,
          minutes: r.minutes,
          utilization: r.utilization,
        })),
      });
      toast.success("PDF exported successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export PDF"
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      exportToExcel({
        dateRange: { from, to },
        crewUtilization,
        activeTechs,
        jobsCompleted: filteredEntries.length,
        totalToday: fmtDuration(
          filteredEntries
            .filter(
              (e) =>
                new Date(e.clock_in).toISOString().slice(0, 10) ===
                today.toISOString().slice(0, 10)
            )
            .reduce((s, e) => s + workedMinutes(e, pauses), 0)
        ),
        totalWeek: fmtDuration(totalMinutes),
        totalMonth: fmtDuration(totalMinutes),
        avgPerTechPerDay: fmtDuration(totalMinutes / Math.max(1, byDay.length)),
        hoursByTech: byTech.map((t) => ({
          name: t.name,
          hours: +(t.minutes / 60).toFixed(2),
          utilization: t.utilization,
        })),
        hoursByType: byJobType.map((j) => ({
          name: j.label,
          hours: +(j.minutes / 60).toFixed(2),
        })),
        dailyRows: byDay.map((r) => ({
          date: fmtDateShort(r.day),
          tech: r.techCount.toString(),
          jobs: r.jobs,
          minutes: r.minutes,
          utilization: r.utilization,
        })),
      });
      toast.success("Excel exported successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export Excel"
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-900 space-y-6">
      {/* Title + Date Range */}
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold">
            {from} to {to}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wide mt-0.5">
            Crew Performance
          </h1>
        </div>
        <ReportFilters
          filters={filters}
          setFilters={setFilters}
          techs={employees.map((e) => ({ id: e.id, label: e.name }))}
          jobTypes={JOB_TYPES}
        />
      </section>

      {/* Date Range + Exports */}
      <div className="bg-white border-2 border-neutral-200 p-4 flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-neutral-500 mb-1.5 block">
              From
            </Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-neutral-500 mb-1.5 block">
              To
            </Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={exporting}
            size="sm"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exporting}
            size="sm"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      {/* KPI scorecard */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Crew Utilization"
          value={crewUtilization.toFixed(0) + "%"}
          sub="Target: 85%"
          accent="var(--util-mid)"
        />
        <KpiCard
          label="Billable Hours"
          value={fmtDuration(totalMinutes).replace("m", "")}
          sub={activeTechs + " active techs"}
        />
        <KpiCard
          label="Jobs Completed"
          value={String(filteredEntries.length)}
          sub={
            (filteredEntries.length / Math.max(1, byDay.length)).toFixed(1) +
            " / day"
          }
        />
        <KpiCard
          label="Avg Job Duration"
          value={fmtDuration(
            filteredEntries.length > 0 ? totalMinutes / filteredEntries.length : 0
          )}
          sub="Across all types"
        />
      </section>

      {/* Row: Utilization + Donut */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card
          className="lg:col-span-2"
          title="Utilization by Technician"
          sub="Click a row for details"
        >
          {vizType === "bars" && (
            <div className="space-y-4">
              {byTech.map((t) => (
                <UtilizationBar
                  key={t.id}
                  pct={t.utilization}
                  label={t.name}
                  hours={fmtDuration(t.minutes) + " · " + t.jobs + " jobs"}
                  onClick={() => setDrillTech(t.id)}
                />
              ))}
            </div>
          )}
          {vizType === "gauges" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {byTech.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setDrillTech(t.id)}
                  className="cursor-pointer hover:bg-neutral-50 p-2 transition-colors"
                >
                  <UtilizationGauge
                    pct={t.utilization}
                    label={t.name}
                    sub={fmtDuration(t.minutes)}
                  />
                </div>
              ))}
            </div>
          )}
          {vizType === "heatmap" && (
            <UtilizationHeatmap
              matrix={matrix}
              onCellClick={(row) =>
                setDrillTech(row.id)
              }
            />
          )}

          {/* Viz type selector */}
          <div className="flex gap-1 mt-4 pt-4 border-t border-neutral-200">
            {(["bars", "gauges", "heatmap"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setVizType(type)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-2 transition-colors ${
                  vizType === type
                    ? "bg-yellow-400 text-black border-black"
                    : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                }`}
              >
                {type === "bars"
                  ? "Bars"
                  : type === "gauges"
                    ? "Gauges"
                    : "Heatmap"}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Time by Job Type" sub={fmtDuration(totalMinutes) + " total"}>
          <JobTypeDonut data={byJobType} size={180} />
        </Card>
      </section>

      {/* Timeline */}
      <Card
        title={"Today's Timeline · " + fmtDateShort(today)}
        sub="Bars show when each tech was on a job · hatched = paused · black outline = active"
      >
        <DayTimeline
          techs={employees}
          entries={entries}
          pauses={pauses}
          jobTypes={JOB_TYPES}
          day={today}
          onEntryClick={(e) => {
            const tech = employees.find((t) => t.id === e.employee_id);
            if (tech) setDrillTech(tech.id);
          }}
        />
      </Card>

      {/* Daily breakdown */}
      <Card title="Daily Breakdown" sub="Utilization = hours worked / (techs × 8h)">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">
                  Date
                </th>
                <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">
                  Day
                </th>
                <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">
                  Techs
                </th>
                <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">
                  Jobs
                </th>
                <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">
                  Hours
                </th>
                <th className="text-left py-2 text-[10px] uppercase tracking-wider font-bold">
                  Utilization
                </th>
              </tr>
            </thead>
            <tbody>
              {byDay.slice().reverse().map((d) => {
                const band = utilizationBand(d.utilization);
                const colorMap = {
                  low: "var(--util-low)",
                  mid: "var(--util-mid)",
                  high: "var(--util-high)",
                };
                const color = colorMap[band];

                return (
                  <tr
                    key={d.day.toDateString()}
                    className="border-b border-neutral-200 hover:bg-neutral-50"
                  >
                    <td className="py-2 pr-4 font-semibold tabular-nums">
                      {fmtDateShort(d.day)}
                    </td>
                    <td className="py-2 pr-4 text-neutral-500 uppercase text-[10px] tracking-wider">
                      {fmtDow(d.day)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {d.techCount}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {d.jobs}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-semibold">
                      {fmtDuration(d.minutes)}
                    </td>
                    <td className="py-2 w-64">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-neutral-100 border border-neutral-200 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width:
                                Math.min(100, (d.utilization / 140) * 100) +
                                "%",
                              background: color,
                            }}
                          />
                        </div>
                        <div className="text-[11px] font-bold tabular-nums w-10 text-right">
                          {d.utilization.toFixed(0)}%
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drill-down panel */}
      <TechnicianDrillSheet
        tech={activeTech || null}
        entries={filteredEntries}
        pauses={pauses}
        jobTypes={JOB_TYPES}
        onClose={() => setDrillTech(null)}
      />
    </div>
  );
}

interface CardProps {
  title: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}

function Card({ title, sub, className = "", children }: CardProps) {
  return (
    <section className={"bg-white border-2 border-neutral-200 " + className}>
      <header className="flex items-baseline justify-between px-5 py-3 border-b-2 border-neutral-200">
        <div>
          <h2 className="text-[12px] font-black uppercase tracking-wider">
            {title}
          </h2>
          {sub && (
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">
              {sub}
            </div>
          )}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
