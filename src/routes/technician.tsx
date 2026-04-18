import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, HcpJob, PauseLog, TimeEntry } from "@/lib/types";
import { JOB_TYPES } from "@/lib/types";
import { updateJobType } from "@/lib/hcp.functions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MCRLogo } from "@/components/MCRLogo";
import { JobTypeBadge } from "@/components/JobTypeBadge";
import { ArrowLeft, MapPin, Pause, Play, Square, User2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDuration, pausedSeconds, totalPauseMinutes, workedSeconds } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/technician")({
  head: () => ({
    meta: [
      { title: "Technician — MCR Tech Performance Tool" },
      { name: "description", content: "Track time on your assigned compactor repair jobs." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    id: (search.id as string | undefined) ?? null,
  }),
  component: TechnicianPage,
});

function TechnicianPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const confirmedId = search.id;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .eq("role", "technician")
        .order("name");
      if (error) {
        toast.error("Failed to load technicians");
      }
      const list = (data ?? []) as Employee[];
      setEmployees(list);
      setLoading(false);
    })();
  }, []);

  const confirmedEmployee = useMemo(
    () => employees.find((e) => e.id === confirmedId) ?? null,
    [employees, confirmedId]
  );

  function handleContinue() {
    if (!selectedId) return;
    navigate({ to: "/technician", search: { id: selectedId } });
    setSelectedId(null);
  }

  function handleSwitch() {
    navigate({ to: "/technician", search: {} });
    setSelectedId(null);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground border-b-4 border-accent">
        <div className="px-4 py-3 flex items-center justify-between max-w-3xl mx-auto w-full">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <MCRLogo className="h-7" variant="light" />
          {confirmedEmployee ? (
            <button
              onClick={handleSwitch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-xs font-semibold uppercase text-accent transition-colors"
              title="Click to change technician"
            >
              <User2 className="w-4 h-4" />
              <span>{confirmedEmployee.name.split(" ")[0]}</span>
              <span className="text-[10px] text-accent/70">Change</span>
            </button>
          ) : (
            <span className="w-12" />
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !confirmedEmployee ? (
          <EmployeeSelect
            employees={employees}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onContinue={handleContinue}
          />
        ) : (
          <TechnicianDashboard employee={confirmedEmployee} />
        )}
      </main>
    </div>
  );
}

function EmployeeSelect({
  employees,
  selectedId,
  onSelect,
  onContinue,
}: {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="max-w-md mx-auto pt-8">
      <h1 className="text-3xl font-bold uppercase tracking-tight">Who's working?</h1>
      <p className="text-muted-foreground mt-1 mb-6">Select your name to see today's jobs.</p>

      <div className="space-y-2">
        {employees.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={cn(
              "w-full text-left px-4 py-4 rounded-lg border-2 transition-all bg-card",
              selectedId === e.id
                ? "border-accent shadow-card-lg"
                : "border-border hover:border-muted-foreground/40"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                  selectedId === e.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-foreground"
                )}
              >
                {e.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="font-semibold">{e.name}</div>
                {e.hcp_employee_id && (
                  <div className="text-xs text-muted-foreground">{e.hcp_employee_id}</div>
                )}
              </div>
            </div>
          </button>
        ))}
        {employees.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
            No active technicians. Ask an admin to add one.
          </div>
        )}
      </div>

      <Button
        size="lg"
        disabled={!selectedId}
        onClick={onContinue}
        className="w-full h-14 mt-6 text-base font-bold uppercase bg-accent hover:bg-accent/90 text-accent-foreground"
      >
        Continue
      </Button>
    </div>
  );
}

function TechnicianDashboard({ employee }: { employee: Employee }) {
  const [jobs, setJobs] = useState<HcpJob[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [pauses, setPauses] = useState<PauseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  async function refresh() {
    const queryDate = selectedDate;

    const jobsPromise = employee.hcp_employee_id
      ? supabase
          .from("hcp_jobs_cache")
          .select("*")
          .eq("scheduled_date", queryDate)
          .contains("assigned_employee_ids", [employee.hcp_employee_id])
          .in("status", ["scheduled", "in progress"])
      : Promise.resolve({ data: [], error: null } as const);

    const entryPromise = supabase
      .from("time_entries")
      .select("*")
      .eq("employee_id", employee.id)
      .in("status", ["active", "paused"])
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    const [jobsRes, entryRes] = await Promise.all([jobsPromise, entryPromise]);

    if (jobsRes.error) toast.error("Failed to load jobs");
    setJobs((jobsRes.data ?? []) as HcpJob[]);

    if (entryRes.error) toast.error("Failed to load active entry");
    const entry = (entryRes.data ?? null) as TimeEntry | null;
    setActiveEntry(entry);

    if (entry) {
      const { data: p } = await supabase
        .from("pause_logs")
        .select("*")
        .eq("time_entry_id", entry.id)
        .order("pause_start", { ascending: true });
      setPauses((p ?? []) as PauseLog[]);
    } else {
      setPauses([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id, selectedDate]);

  async function handleStart(job: HcpJob) {
    if (activeEntry?.status === "active") {
      toast.error("Finish or pause your current job before starting a new one.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("time_entries").insert({
      employee_id: employee.id,
      hcp_job_id: job.hcp_job_id,
      job_number: job.job_number,
      customer_name: job.customer_name,
      job_type: job.job_type,
      job_address: job.job_address,
      clock_in: new Date().toISOString(),
      status: "active",
    });
    setBusy(false);
    if (error) {
      toast.error(`Failed to start: ${error.message}`);
      return;
    }
    toast.success(`Clocked in on Job #${job.job_number}`);
    await refresh();
  }

  async function handlePause() {
    if (!activeEntry) return;
    setBusy(true);
    const now = new Date().toISOString();
    if (activeEntry.status === "active") {
      const { error } = await supabase.from("pause_logs").insert({
        time_entry_id: activeEntry.id,
        pause_start: now,
      });
      if (error) {
        toast.error(`Failed to pause: ${error.message}`);
        setBusy(false);
        return;
      }
      const { error: updateError } = await supabase
        .from("time_entries")
        .update({ status: "paused" })
        .eq("id", activeEntry.id);
      if (updateError) {
        toast.error(`Failed to update: ${updateError.message}`);
        setBusy(false);
        return;
      }
      toast.success("Paused");
    } else if (activeEntry.status === "paused") {
      const latestPause = pauses[pauses.length - 1];
      if (latestPause && !latestPause.pause_end) {
        const { error } = await supabase
          .from("pause_logs")
          .update({ pause_end: now })
          .eq("id", latestPause.id);
        if (error) {
          toast.error(`Failed to resume: ${error.message}`);
          setBusy(false);
          return;
        }
      }
      const { error: updateError } = await supabase
        .from("time_entries")
        .update({ status: "active" })
        .eq("id", activeEntry.id);
      if (updateError) {
        toast.error(`Failed to update: ${updateError.message}`);
        setBusy(false);
        return;
      }
      toast.success("Resumed");
    }
    setBusy(false);
    await refresh();
  }

  async function handleFinish() {
    if (!activeEntry) return;
    setBusy(true);
    const now = new Date().toISOString();
    let totalMinutes = Math.round((new Date(now).getTime() - new Date(activeEntry.clock_in).getTime()) / 1000 / 60);
    const pausedMs = pauses.reduce((sum, p) => {
      const end = p.pause_end ?? now;
      return sum + (new Date(end).getTime() - new Date(p.pause_start).getTime());
    }, 0);
    totalMinutes -= Math.round(pausedMs / 1000 / 60);

    const closePausesUpdate = pauses
      .filter((p) => !p.pause_end)
      .map((p) =>
        supabase
          .from("pause_logs")
          .update({ pause_end: now })
          .eq("id", p.id)
      );

    await Promise.all(closePausesUpdate);

    const { error } = await supabase
      .from("time_entries")
      .update({
        clock_out: now,
        status: "completed",
        total_minutes: totalMinutes,
      })
      .eq("id", activeEntry.id);
    setBusy(false);
    if (error) {
      toast.error(`Failed to finish: ${error.message}`);
      return;
    }
    toast.success("Clocked out");
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tight mb-2">{employee.name}'s Jobs</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-muted-foreground">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 py-1 border border-border rounded text-sm"
          />
        </div>
      </div>

      {activeEntry && (
        <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
          <div className="font-bold uppercase text-accent mb-2">Active Job</div>
          <div className="text-sm space-y-1">
            <div>Job #{activeEntry.job_number} · {activeEntry.customer_name}</div>
            <div className="text-xs text-muted-foreground">{activeEntry.job_address}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="tabular-nums font-mono">
                {formatDuration(
                  Math.round((tick % 60) + (new Date().getTime() - new Date(activeEntry.clock_in).getTime()) / 1000 / 60)
                )}
              </span>
              <Button size="sm" variant="outline" onClick={handlePause} disabled={busy}>
                {activeEntry.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={handleFinish} disabled={busy}>
                <Square className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
            No jobs scheduled for today.
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="p-4 border-l-4 border-accent rounded bg-card space-y-3"
            >
              <div className="text-left">
                <div className="font-bold uppercase">{job.customer_name}</div>
                <div className="text-xs text-muted-foreground mt-1">Job #{job.job_number}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3" />
                  {job.job_address}
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {JOB_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={async () => {
                      try {
                        const result = await updateJobType({
                          data: { jobId: job.id, jobType: type },
                        });
                        if (!result.ok) {
                          toast.error(`Failed to update job type: ${result.error}`);
                          return;
                        }
                        await refresh();
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        toast.error(`Failed to update job type: ${msg}`);
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold uppercase rounded transition-colors",
                      job.job_type === type
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    )}
                  >
                    {type.split(" ")[0]}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => handleStart(job)}
                disabled={busy || (activeEntry?.status === "active")}
                className="w-full h-10 text-sm font-bold uppercase bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-50"
              >
                Start Job
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
