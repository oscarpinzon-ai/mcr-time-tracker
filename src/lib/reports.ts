import type { TimeEntry, PauseLog, Employee } from "./types";

export const AVAILABLE_HOURS_PER_DAY = 8;

// Calculate worked minutes for an entry, accounting for pauses
export function workedMinutes(
  entry: TimeEntry,
  allPauses: PauseLog[]
): number {
  const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
  const start = new Date(entry.clock_in).getTime();
  const gross = (end - start) / 60000; // Convert to minutes

  // Sum pause durations for this entry
  const pauseTotal = allPauses
    .filter((p) => p.time_entry_id === entry.id)
    .reduce((sum, p) => {
      const pauseStart = new Date(p.pause_start).getTime();
      const pauseEnd = p.pause_end
        ? new Date(p.pause_end).getTime()
        : Date.now();
      return sum + (pauseEnd - pauseStart) / 60000;
    }, 0);

  return Math.max(0, gross - pauseTotal);
}

export interface TechAggregate {
  id: string;
  name: string;
  color?: string;
  initials?: string;
  minutes: number;
  jobs: number;
  daysWorked: number;
  utilization: number;
  entries: TimeEntry[];
}

export function aggregateByTech(
  entries: TimeEntry[],
  pauses: PauseLog[],
  techs: Employee[]
): TechAggregate[] {
  const byTech = techs.map((t) => ({
    id: t.id,
    name: t.name,
    color: undefined,
    initials: t.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase(),
    minutes: 0,
    jobs: 0,
    daysWorked: 0,
    utilization: 0,
    entries: [] as TimeEntry[],
  }));

  const map = new Map(byTech.map((t) => [t.id, t]));
  const daysByTech = new Map<string, Set<string>>();

  entries.forEach((e) => {
    const t = map.get(e.employee_id);
    if (!t) return;

    const mins = workedMinutes(e, pauses);
    t.minutes += mins;
    t.jobs += 1;
    t.entries.push(e);

    // Track unique days per tech
    const dayStr = new Date(e.clock_in).toDateString();
    if (!daysByTech.has(t.id)) daysByTech.set(t.id, new Set());
    daysByTech.get(t.id)!.add(dayStr);
  });

  byTech.forEach((t) => {
    t.daysWorked = daysByTech.get(t.id)?.size ?? 0;
    t.utilization =
      t.daysWorked > 0
        ? ((t.minutes / 60) / (t.daysWorked * AVAILABLE_HOURS_PER_DAY)) * 100
        : 0;
  });

  return byTech;
}

export interface JobTypeAggregate {
  id: string;
  label: string;
  minutes: number;
  jobs: number;
}

export function aggregateByJobType(
  entries: TimeEntry[],
  pauses: PauseLog[],
  jobTypes: Array<{ id: string; label: string }>
): JobTypeAggregate[] {
  const out = jobTypes.map((jt) => ({
    ...jt,
    minutes: 0,
    jobs: 0,
  }));

  const map = new Map(out.map((j) => [j.id, j]));

  entries.forEach((e) => {
    const jobTypeId = e.job_type ?? "other";
    const j = map.get(jobTypeId);
    if (!j) {
      // Add unknown job type dynamically
      const newType = { id: jobTypeId, label: e.job_type ?? "Other", minutes: 0, jobs: 0 };
      out.push(newType);
      map.set(jobTypeId, newType);
    }

    const j2 = map.get(jobTypeId)!;
    j2.minutes += workedMinutes(e, pauses);
    j2.jobs += 1;
  });

  return out;
}

export interface DayAggregate {
  day: Date;
  minutes: number;
  jobs: number;
  techCount: number;
  utilization: number;
}

export function aggregateByDay(
  entries: TimeEntry[],
  pauses: PauseLog[]
): DayAggregate[] {
  const map = new Map<string, DayAggregate>();

  entries.forEach((e) => {
    const dayStr = new Date(e.clock_in).toDateString();
    const dayDate = new Date(e.clock_in);
    dayDate.setHours(0, 0, 0, 0);

    if (!map.has(dayStr)) {
      map.set(dayStr, {
        day: dayDate,
        minutes: 0,
        jobs: 0,
        techCount: 0,
        utilization: 0,
      });
    }

    const r = map.get(dayStr)!;
    r.minutes += workedMinutes(e, pauses);
    r.jobs += 1;
  });

  // Track unique techs per day
  const techsByDay = new Map<string, Set<string>>();
  entries.forEach((e) => {
    const dayStr = new Date(e.clock_in).toDateString();
    if (!techsByDay.has(dayStr)) techsByDay.set(dayStr, new Set());
    techsByDay.get(dayStr)!.add(e.employee_id);
  });

  map.forEach((r, dayStr) => {
    r.techCount = techsByDay.get(dayStr)?.size ?? 0;
    r.utilization =
      r.techCount > 0
        ? ((r.minutes / 60) / (r.techCount * AVAILABLE_HOURS_PER_DAY)) * 100
        : 0;
  });

  return Array.from(map.values()).sort((a, b) => a.day.getTime() - b.day.getTime());
}

export interface DayCell {
  day: Date;
  minutes: number;
  utilization: number;
}

export interface TechDayMatrix {
  id: string;
  name: string;
  initials?: string;
  color?: string;
  days: DayCell[];
}

export function techDayMatrix(
  entries: TimeEntry[],
  pauses: PauseLog[],
  techs: Employee[],
  workdays: Date[]
): TechDayMatrix[] {
  return techs.map((t) => ({
    id: t.id,
    name: t.name,
    initials: t.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase(),
    color: undefined,
    days: workdays.map((d) => {
      const dayEntries = entries.filter((e) => {
        const eDay = new Date(e.clock_in);
        return (
          e.employee_id === t.id &&
          eDay.getFullYear() === d.getFullYear() &&
          eDay.getMonth() === d.getMonth() &&
          eDay.getDate() === d.getDate()
        );
      });

      const mins = dayEntries.reduce(
        (s, e) => s + workedMinutes(e, pauses),
        0
      );

      return {
        day: d,
        minutes: mins,
        utilization: ((mins / 60) / AVAILABLE_HOURS_PER_DAY) * 100,
      };
    }),
  }));
}

export function utilizationBand(pct: number): "low" | "mid" | "high" {
  if (pct >= 85) return "high";
  if (pct >= 65) return "mid";
  return "low";
}

export function fmtDuration(mins: number | null): string {
  if (mins == null || isNaN(mins)) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h + "h " + String(m).padStart(2, "0") + "m";
}

export function fmtHM(dateStr: string): string {
  const date = new Date(dateStr);
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return hh + ":" + String(m).padStart(2, "0") + " " + ampm;
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDow(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function applyFilters(
  entries: TimeEntry[],
  techIds: string[],
  jobTypeIds: string[]
): TimeEntry[] {
  return entries.filter((e) => {
    if (techIds.length && !techIds.includes(e.employee_id)) return false;
    if (jobTypeIds.length && !jobTypeIds.includes(e.job_type ?? "other"))
      return false;
    return true;
  });
}

export function getWorkdays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  while (d <= end) {
    const dow = d.getDay();
    // Mon (1) - Sat (6), not Sun (0)
    if (dow !== 0) {
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  return days;
}
