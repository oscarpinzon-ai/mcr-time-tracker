import type { PauseLog, TimeEntry } from "./types";

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes < 0) return "0h 0m";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${m}m`;
}

/** Active worked seconds for a time entry given its pause logs and a "now" timestamp. */
export function workedSeconds(
  entry: TimeEntry,
  pauses: PauseLog[],
  now: number = Date.now()
): number {
  const start = new Date(entry.clock_in).getTime();
  const end = entry.clock_out ? new Date(entry.clock_out).getTime() : now;
  let pausedMs = 0;
  for (const p of pauses) {
    const ps = new Date(p.pause_start).getTime();
    const pe = p.pause_end ? new Date(p.pause_end).getTime() : now;
    pausedMs += Math.max(0, pe - ps);
  }
  return Math.max(0, Math.floor((end - start - pausedMs) / 1000));
}

export function pausedSeconds(pauses: PauseLog[], now: number = Date.now()): number {
  const open = pauses.find((p) => !p.pause_end);
  if (!open) return 0;
  return Math.max(0, Math.floor((now - new Date(open.pause_start).getTime()) / 1000));
}

export function totalPauseMinutes(pauses: PauseLog[]): number {
  let ms = 0;
  for (const p of pauses) {
    if (!p.pause_end) continue;
    ms += new Date(p.pause_end).getTime() - new Date(p.pause_start).getTime();
  }
  return Math.round(ms / 60000);
}
