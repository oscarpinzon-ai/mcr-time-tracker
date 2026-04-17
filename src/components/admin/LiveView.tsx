import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncHcpJobs } from "@/lib/hcp.functions";
import type { Employee, PauseLog, TimeEntry } from "@/lib/types";
import { formatDuration, workedSeconds } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type EmployeeStatus = {
  employee: Employee;
  entry: TimeEntry | null;
  pauses: PauseLog[];
};

export function LiveView() {
  const [data, setData] = useState<EmployeeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncFn = useServerFn(syncHcpJobs);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 30000);
    return () => clearInterval(refresh);
  }, []);

  async function load() {
    const { data: emps } = await supabase
      .from("employees")
      .select("*")
      .eq("is_active", true)
      .eq("role", "technician")
      .order("name");
    const employees = (emps ?? []) as Employee[];

    const { data: entries } = await supabase
      .from("time_entries")
      .select("*")
      .in("status", ["active", "paused"]);
    const activeEntries = (entries ?? []) as TimeEntry[];

    const entryIds = activeEntries.map((e) => e.id);
    let allPauses: PauseLog[] = [];
    if (entryIds.length > 0) {
      const { data: p } = await supabase
        .from("pause_logs")
        .select("*")
        .in("time_entry_id", entryIds);
      allPauses = (p ?? []) as PauseLog[];
    }

    const result: EmployeeStatus[] = employees.map((emp) => {
      const entry = activeEntries.find((e) => e.employee_id === emp.id) ?? null;
      const pauses = entry ? allPauses.filter((p) => p.time_entry_id === entry.id) : [];
      return { employee: emp, entry, pauses };
    });
    setData(result);
    setLoading(false);
  }

  async function handleSyncJobs() {
    setSyncing(true);
    try {
      const result = await syncFn();
      toast.success(`Synced ${result.total} jobs`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync jobs");
    } finally {
      setSyncing(false);
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Crew Status</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncJobs}
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Jobs'}
          </Button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Auto-refresh · 30s
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((row) => (
          <StatusCard key={row.employee.id} row={row} tick={tick} />
        ))}
        {data.length === 0 && (
          <div className="col-span-full text-center py-16 border-2 border-dashed border-border rounded-lg bg-card">
            <p className="text-muted-foreground">No active technicians.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ row, tick }: { row: EmployeeStatus; tick: number }) {
  void tick;
  const status: "Working" | "Paused" | "Idle" = !row.entry
    ? "Idle"
    : row.entry.status === "paused"
      ? "Paused"
      : "Working";

  const statusStyles = {
    Working: { dot: "bg-success animate-pulse", border: "border-success", chip: "bg-success/15 text-foreground" },
    Paused: { dot: "bg-warning", border: "border-warning", chip: "bg-warning/15 text-foreground" },
    Idle: { dot: "bg-muted-foreground/40", border: "border-border", chip: "bg-muted text-muted-foreground" },
  }[status];

  const elapsed = row.entry ? formatDuration(workedSeconds(row.entry, row.pauses)) : "00:00:00";

  return (
    <div className={cn("bg-card rounded-xl border-2 p-4 shadow-card", statusStyles.border)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center font-bold text-sm">
            {row.employee.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="font-semibold leading-tight">{row.employee.name}</div>
            {row.employee.hcp_employee_id && (
              <div className="text-[10px] text-muted-foreground">{row.employee.hcp_employee_id}</div>
            )}
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest", statusStyles.chip)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", statusStyles.dot)} />
          {status}
        </span>
      </div>

      {row.entry ? (
        <div>
          <div className="flex items-center gap-1.5 text-sm">
            <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-bold">#{row.entry.job_number}</span>
            <span className="text-muted-foreground truncate">· {row.entry.customer_name}</span>
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold">{elapsed}</div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">No active job</div>
      )}
    </div>
  );
}
