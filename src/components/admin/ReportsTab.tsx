import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, PauseLog, TimeEntry } from "@/lib/types";
import { formatHoursMinutes, workedSeconds } from "@/lib/time";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

type EntryWithPauses = { entry: TimeEntry; pauses: PauseLog[] };

const AVAILABLE_HOURS_PER_DAY = 8; // 8-hour workday

export function ReportsTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [data, setData] = useState<EntryWithPauses[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
    if (empRes.error || entRes.error) toast.error("Failed to load reports");
    const emps = (empRes.data ?? []) as Employee[];
    const entries = (entRes.data ?? []) as TimeEntry[];

    const ids = entries.map((e) => e.id);
    let pauses: PauseLog[] = [];
    if (ids.length > 0) {
      const { data: p } = await supabase.from("pause_logs").select("*").in("time_entry_id", ids);
      pauses = (p ?? []) as PauseLog[];
    }

    setEmployees(emps);
    setData(entries.map((e) => ({ entry: e, pauses: pauses.filter((p) => p.time_entry_id === e.id) })));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Helpers
  function entryMinutes(e: EntryWithPauses): number {
    if (e.entry.total_minutes != null) return Number(e.entry.total_minutes);
    const end = e.entry.clock_out ? new Date(e.entry.clock_out).getTime() : Date.now();
    return Math.round(workedSeconds(e.entry, e.pauses, end) / 60);
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      // Compute current data to ensure we export latest
      await new Promise(r => setTimeout(r, 100));
      exportToPDF({
        dateRange: { from, to },
        totalToday: formatHoursMinutes(totalToday),
        totalWeek: formatHoursMinutes(totalWeek),
        totalMonth: formatHoursMinutes(totalMonth),
        avgPerTechPerDay: formatHoursMinutes(avgPerTechPerDay),
        hoursByTech,
        hoursByType,
        dailyRows: dailyRows.map(r => ({
          date: r.date,
          tech: r.tech,
          jobs: r.jobs,
          minutes: r.minutes,
          utilization: (r.minutes / 60 / 13) * 100,
        })),
      });
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      exportToExcel({
        dateRange: { from, to },
        totalToday: formatHoursMinutes(totalToday),
        totalWeek: formatHoursMinutes(totalWeek),
        totalMonth: formatHoursMinutes(totalMonth),
        avgPerTechPerDay: formatHoursMinutes(avgPerTechPerDay),
        hoursByTech,
        hoursByType,
        dailyRows: dailyRows.map(r => ({
          date: r.date,
          tech: r.tech,
          jobs: r.jobs,
          minutes: r.minutes,
          utilization: (r.minutes / 60 / 13) * 100,
        })),
      });
      toast.success('Excel exported successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  }

  // Summary cards (today / week / month, all-time within filter)
  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const startOfMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const totalToday = data.filter((e) => e.entry.clock_in.slice(0, 10) === todayStr).reduce((s, e) => s + entryMinutes(e), 0);
  const totalWeek = data.filter((e) => new Date(e.entry.clock_in) >= startOfWeek).reduce((s, e) => s + entryMinutes(e), 0);
  const totalMonth = data.filter((e) => new Date(e.entry.clock_in) >= startOfMonth).reduce((s, e) => s + entryMinutes(e), 0);

  const techEntriesThisMonth = data.filter((e) => new Date(e.entry.clock_in) >= startOfMonth);
  const techDayKeys = new Set(techEntriesThisMonth.map((e) => `${e.entry.employee_id}|${e.entry.clock_in.slice(0, 10)}`));
  const avgPerTechPerDay = techDayKeys.size > 0 ? totalMonth / techDayKeys.size : 0;

  // Hours by technician
  const hoursByTech = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data) {
      map.set(e.entry.employee_id, (map.get(e.entry.employee_id) ?? 0) + entryMinutes(e));
    }
    return employees
      .map((emp) => ({
        name: emp.name,
        hours: +(((map.get(emp.id) ?? 0) / 60)).toFixed(2),
      }))
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, employees]);

  // Hours by job type
  const hoursByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data) {
      const t = e.entry.job_type ?? "Other";
      map.set(t, (map.get(t) ?? 0) + entryMinutes(e));
    }
    return Array.from(map.entries())
      .map(([name, mins]) => ({ name, hours: +(mins / 60).toFixed(2) }))
      .sort((a, b) => b.hours - a.hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Daily breakdown
  const dailyRows = useMemo(() => {
    const map = new Map<string, { date: string; tech: string; jobs: number; minutes: number; empId: string }>();
    for (const e of data) {
      const date = e.entry.clock_in.slice(0, 10);
      const key = `${date}|${e.entry.employee_id}`;
      const cur = map.get(key) ?? {
        date,
        tech: employees.find((emp) => emp.id === e.entry.employee_id)?.name ?? "Unknown",
        jobs: 0,
        minutes: 0,
        empId: e.entry.employee_id,
      };
      cur.jobs += 1;
      cur.minutes += entryMinutes(e);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, employees]);

  const pieColors = ["oklch(0.78 0.16 70)", "oklch(0.18 0 0)", "oklch(0.55 0.005 270)", "oklch(0.72 0.18 145)"];

  return (
    <div className="space-y-5">
      {/* Date range + exports */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-card flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 block">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 block">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={exporting || loading}
          >
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exporting || loading}
          >
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}
            Export Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Today" value={formatHoursMinutes(totalToday)} />
            <SummaryCard label="This Week" value={formatHoursMinutes(totalWeek)} />
            <SummaryCard label="This Month" value={formatHoursMinutes(totalMonth)} />
            <SummaryCard label="Avg / Tech / Day" value={formatHoursMinutes(avgPerTechPerDay)} />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Hours by Technician">
              {hoursByTech.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, hoursByTech.length * 36)}>
                  <BarChart data={hoursByTech} layout="vertical" margin={{ top: 10, right: 16, bottom: 10, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="var(--color-muted-foreground)" fontSize={11} width={110} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}h`, "Hours"]}
                    />
                    <Bar dataKey="hours" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Hours by Job Type">
              {hoursByType.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={hoursByType} dataKey="hours" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {hoursByType.map((_, i) => (
                        <Cell key={i} fill={pieColors[i % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}h`, "Hours"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Daily breakdown */}
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold uppercase tracking-tight">Daily Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Utilization %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No data in this range.</TableCell></TableRow>
                  ) : (
                    dailyRows.map((r) => {
                      const hours = r.minutes / 60;
                      const util = (hours / AVAILABLE_HOURS_PER_DAY) * 100;
                      return (
                        <TableRow key={`${r.date}-${r.empId}`} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-xs">{r.date}</TableCell>
                          <TableCell className="font-medium">{r.tech}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.jobs}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums">{formatHoursMinutes(r.minutes)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span
                              className={
                                util >= 80 ? "text-success font-bold" : util >= 50 ? "text-foreground" : "text-warning font-semibold"
                              }
                            >
                              {util.toFixed(0)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-card">
      <div className="text-xs uppercase font-semibold tracking-widest text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold font-display tabular-nums mt-1">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-bold uppercase tracking-tight">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data in this range.</div>;
}
