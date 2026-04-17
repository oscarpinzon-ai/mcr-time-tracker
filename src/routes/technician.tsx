import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, HcpJob, PauseLog, TimeEntry } from "@/lib/types";
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
  component: TechnicianPage,
});

const STORAGE_KEY = "mcr.selectedTechnicianId";

function TechnicianPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
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
      } else {
        setEmployees((data ?? []) as Employee[]);
      }
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        setSelectedId(stored);
        setConfirmedId(stored);
      }
      setLoading(false);
    })();
  }, []);

  const confirmedEmployee = useMemo(
    () => employees.find((e) => e.id === confirmedId) ?? null,
    [employees, confirmedId]
  );

  function handleContinue() {
    if (!selectedId) return;
    localStorage.setItem(STORAGE_KEY, selectedId);
    setConfirmedId(selectedId);
  }

  function handleSwitch() {
    localStorage.removeItem(STORAGE_KEY);
    setConfirmedId(null);
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
              className="flex items-center gap-1.5 text-xs font-semibold uppercase text-accent hover:text-accent/80"
            >
              <User2 className="w-3.5 h-3.5" />
              {confirmedEmployee.name.split(" ")[0]}
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
    if (activeEntry) {
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
    const [{ error: pErr }, { error: eErr }] = await Promise.all([
      supabase.from("pause_logs").insert({ time_entry_id: activeEntry.id, pause_start: now }),
      supabase.from("time_entries").update({ status: "paused" }).eq("id", activeEntry.id),
    ]);
    setBusy(false);
    if (pErr || eErr) {
      toast.error(`Failed to pause: ${(pErr ?? eErr)?.message}`);
      return;
    }
    toast.message("Paused");
    await refresh();
  }

  async function handleResume() {
    if (!activeEntry) return;
    const open = pauses.find((p) => !p.pause_end);
    if (!open) return;
    setBusy(true);
    const now = new Date().toISOString();
    const [{ error: pErr }, { error: eErr }] = await Promise.all([
      supabase.from("pause_logs").update({ pause_end: now }).eq("id", open.id),
      supabase.from("time_entries").update({ status: "active" }).eq("id", activeEntry.id),
    ]);
    setBusy(false);
    if (pErr || eErr) {
      toast.error(`Failed to resume: ${(pErr ?? eErr)?.message}`);
      return;
    }
    toast.success("Resumed");
    await refresh();
  }

  async function handleStop() {
    if (!activeEntry) return;
    setBusy(true);
    const now = new Date().toISOString();
    // Close any open pause
    const open = pauses.find((p) => !p.pause_end);
    if (open) {
      await supabase.from("pause_logs").update({ pause_end: now }).eq("id", open.id);
    }
    const refreshedPauses = open
      ? pauses.map((p) => (p.id === open.id ? { ...p, pause_end: now } : p))
      : pauses;

    const finalEntry = { ...activeEntry, clock_out: now };
    const totalSec = workedSeconds(finalEntry, refreshedPauses, new Date(now).getTime());
    const totalMin = Math.round(totalSec / 60);

    const { error } = await supabase
      .from("time_entries")
      .update({
        clock_out: now,
        status: "completed",
        total_minutes: totalMin,
      })
      .eq("id", activeEntry.id);
    setBusy(false);
    if (error) {
      toast.error(`Failed to stop: ${error.message}`);
      return;
    }
    toast.success(`Job complete · ${Math.floor(totalMin / 60)}h ${totalMin % 60}m logged`);
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sort: active job first, then the rest
  const orderedJobs = [...jobs].sort((a, b) => {
    const aActive = activeEntry?.hcp_job_id === a.hcp_job_id ? 1 : 0;
    const bActive = activeEntry?.hcp_job_id === b.hcp_job_id ? 1 : 0;
    return bActive - aActive;
  });

  // Include the active entry as a synthetic "job" if it isn't in today's list
  const hasActiveInList =
    !activeEntry || jobs.some((j) => j.hcp_job_id === activeEntry.hcp_job_id);

  const selectedDateObj = new Date(selectedDate);
  const today = (() => {
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
  })();
  const isToday = selectedDate === today;

  function handlePrevDay() {
    const prev = new Date(selectedDateObj);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev.toISOString().slice(0, 10));
  }

  function handleNextDay() {
    const next = new Date(selectedDateObj);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next.toISOString().slice(0, 10));
  }

  function handleToday() {
    setSelectedDate(today);
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {isToday ? "Today" : "Selected Date"} · {selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <h1 className="text-3xl font-bold uppercase tracking-tight">
          {employee.name}'s Jobs
        </h1>
      </div>

      {/* Date Picker */}
      <div className="bg-card border border-border rounded-lg p-4 mb-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={handlePrevDay}
            className="flex-1 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm transition-colors"
          >
            ← Prev
          </button>
          <div className="flex-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            onClick={handleNextDay}
            className="flex-1 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm transition-colors"
          >
            Next →
          </button>
        </div>
        {!isToday && (
          <button
            onClick={handleToday}
            className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm transition-colors"
          >
            Back to Today
          </button>
        )}
      </div>

      {!hasActiveInList && activeEntry && (
        <ActiveEntryCard
          entry={activeEntry}
          pauses={pauses}
          tick={tick}
          busy={busy}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          standalone
        />
      )}

      <div className="space-y-3">
        {orderedJobs.map((job) => {
          const isActiveJob = activeEntry?.hcp_job_id === job.hcp_job_id;
          return (
            <JobCard
              key={job.id}
              job={job}
              activeEntry={isActiveJob ? activeEntry : null}
              pauses={isActiveJob ? pauses : []}
              tick={tick}
              busy={busy}
              hasOtherActive={!!activeEntry && !isActiveJob}
              onStart={() => handleStart(job)}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          );
        })}
        {orderedJobs.length === 0 && !activeEntry && (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg bg-card">
            <p className="text-muted-foreground font-medium">No jobs assigned for {isToday ? "today" : "this date"}.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isToday ? "Check back later or contact dispatch." : "Try a different date or contact dispatch."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveEntryCard({
  entry,
  pauses,
  tick,
  busy,
  onPause,
  onResume,
  onStop,
  standalone,
}: {
  entry: TimeEntry;
  pauses: PauseLog[];
  tick: number;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  standalone?: boolean;
}) {
  // tick is used to force re-renders for the live timer
  void tick;
  const isPaused = entry.status === "paused";
  const worked = workedSeconds(entry, pauses);
  const pauseDur = isPaused ? pausedSeconds(pauses) : 0;

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-5 mb-4 shadow-card-lg",
        isPaused ? "border-warning bg-warning/5" : "border-success bg-success/5",
        standalone && "ring-2 ring-offset-2 ring-accent/30"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex w-2.5 h-2.5 rounded-full",
              isPaused ? "bg-warning" : "bg-success animate-pulse"
            )}
          />
          <span className="text-xs uppercase font-bold tracking-widest">
            {isPaused ? "Paused" : "Working"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Job #{entry.job_number}</span>
      </div>
      <div className="text-center py-2">
        <div className="text-5xl font-bold font-display tabular-nums tracking-tight">
          {formatDuration(worked)}
        </div>
        {isPaused && (
          <div className="text-warning font-semibold mt-1 text-sm">
            Paused for {formatDuration(pauseDur)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {isPaused ? (
          <Button
            disabled={busy}
            onClick={onResume}
            className="h-14 text-base font-bold uppercase bg-success hover:bg-success/90 text-success-foreground"
          >
            <Play className="w-5 h-5 mr-1" /> Resume
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={onPause}
            className="h-14 text-base font-bold uppercase bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            <Pause className="w-5 h-5 mr-1" /> Pause
          </Button>
        )}
        <Button
          disabled={busy}
          onClick={onStop}
          className="h-14 text-base font-bold uppercase bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          <Square className="w-5 h-5 mr-1" /> Stop
        </Button>
      </div>
    </div>
  );
}

function JobCard({
  job,
  activeEntry,
  pauses,
  tick,
  busy,
  hasOtherActive,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  job: HcpJob;
  activeEntry: TimeEntry | null;
  pauses: PauseLog[];
  tick: number;
  busy: boolean;
  hasOtherActive: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  void tick;
  const isActive = !!activeEntry;
  const isPaused = activeEntry?.status === "paused";
  const worked = activeEntry ? workedSeconds(activeEntry, pauses) : 0;
  const pauseDur = isPaused ? pausedSeconds(pauses) : 0;

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card shadow-card transition-all",
        isActive
          ? isPaused
            ? "border-warning"
            : "border-success"
          : "border-border"
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-3xl font-bold font-display leading-none">
              #{job.job_number}
            </div>
            <div className="font-semibold mt-1.5 text-foreground">{job.customer_name}</div>
          </div>
          <JobTypeBadge type={job.job_type} />
        </div>
        {job.job_address && (
          <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{job.job_address}</span>
          </div>
        )}
      </div>

      {isActive && activeEntry ? (
        <div className={cn("border-t-2 px-4 py-3", isPaused ? "border-warning bg-warning/5" : "border-success bg-success/5")}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex w-2.5 h-2.5 rounded-full",
                  isPaused ? "bg-warning" : "bg-success animate-pulse"
                )}
              />
              <span className="text-xs uppercase font-bold tracking-widest">
                {isPaused ? "Paused" : "Working"}
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-display tabular-nums leading-none">
                {formatDuration(worked)}
              </div>
              {isPaused && (
                <div className="text-warning text-[11px] font-semibold mt-0.5">
                  Paused {formatDuration(pauseDur)}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {isPaused ? (
              <Button
                disabled={busy}
                onClick={onResume}
                className="h-13 py-3 text-sm font-bold uppercase bg-success hover:bg-success/90 text-success-foreground"
              >
                <Play className="w-4 h-4 mr-1" /> Resume
              </Button>
            ) : (
              <Button
                disabled={busy}
                onClick={onPause}
                className="h-13 py-3 text-sm font-bold uppercase bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                <Pause className="w-4 h-4 mr-1" /> Pause
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={onStop}
              className="h-13 py-3 text-sm font-bold uppercase bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3">
          <Button
            disabled={busy || hasOtherActive}
            onClick={onStart}
            className="w-full h-13 py-3 text-sm font-bold uppercase bg-success hover:bg-success/90 text-success-foreground disabled:bg-muted disabled:text-muted-foreground"
          >
            <Play className="w-4 h-4 mr-1" />
            {hasOtherActive ? "Another job is active" : "Start"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Suppress unused warning for totalPauseMinutes (used elsewhere)
void totalPauseMinutes;
