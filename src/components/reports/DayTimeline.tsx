import { fmtHM, sameDay } from "@/lib/reports";
import type { TimeEntry, PauseLog } from "@/lib/types";

interface DayTimelineProps {
  techs: Array<{ id: string; name: string; initials?: string }>;
  entries: TimeEntry[];
  pauses: PauseLog[];
  jobTypes: Array<{ id: string; label: string }>;
  day: Date;
  onEntryClick?: (entry: TimeEntry) => void;
}

export function DayTimeline({
  techs,
  entries,
  pauses,
  jobTypes,
  day,
  onEntryClick,
}: DayTimelineProps) {
  const START = 6 * 60; // 6:00 AM
  const END = 20 * 60; // 8:00 PM
  const span = END - START;

  const jobTypeColors: Record<string, string> = {
    "Service Call / Repair": "var(--util-mid)",
    "Yard Work": "var(--util-high)",
    "Installation / Removal": "oklch(0.45 0.10 250)",
  };

  const hourTicks: number[] = [];
  for (let h = 6; h <= 20; h += 2) hourTicks.push(h);

  function minsOfDay(d: string): number {
    const date = new Date(d);
    return date.getHours() * 60 + date.getMinutes();
  }

  return (
    <div>
      {/* Axis */}
      <div className="relative ml-24 mb-2" style={{ height: 16 }}>
        {hourTicks.map((h) => {
          const x = (((h * 60 - START) / span) * 100);
          return (
            <div
              key={h}
              className="absolute top-0"
              style={{ left: x + "%" }}
            >
              <div className="w-px h-2 bg-neutral-300" />
              <div className="text-[9px] text-neutral-500 -translate-x-1/2 mt-0.5 tabular-nums uppercase tracking-wide">
                {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {techs.map((tech) => {
          const techEntries = entries.filter(
            (e) => e.employee_id === tech.id && sameDay(new Date(e.clock_in), day)
          );
          const techPauses = pauses.filter((p) =>
            techEntries.some((e) => e.id === p.time_entry_id)
          );

          return (
            <div key={tech.id} className="flex items-center">
              <div className="w-24 pr-3 text-[11px] font-bold uppercase tracking-wider text-neutral-900 whitespace-nowrap overflow-hidden text-ellipsis">
                {tech.initials} {tech.name.split(" ")[1]}
              </div>
              <div className="relative flex-1 h-7 bg-neutral-100 border border-neutral-200">
                {/* Hour grid */}
                {hourTicks.map((h) => {
                  const x = (((h * 60 - START) / span) * 100);
                  return (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px pointer-events-none"
                      style={{
                        left: x + "%",
                        background: "oklch(0.90 0 0)",
                      }}
                    />
                  );
                })}
                {/* Job bars */}
                {techEntries.map((e) => {
                  const s = minsOfDay(e.clock_in);
                  const end = e.clock_out
                    ? minsOfDay(e.clock_out)
                    : minsOfDay(new Date().toISOString());
                  const left = Math.max(0, ((s - START) / span) * 100);
                  const width = Math.max(0.5, ((end - s) / span) * 100);
                  const isActive = !e.clock_out;

                  const jobTypeColor =
                    jobTypeColors[e.job_type || ""] || "oklch(0.70 0.14 200)";

                  return (
                    <div
                      key={e.id}
                      onClick={() => onEntryClick?.(e)}
                      className="absolute top-0 bottom-0 cursor-pointer transition-all hover:brightness-110 hover:z-10"
                      style={{
                        left: left + "%",
                        width: width + "%",
                        background: jobTypeColor,
                        borderRadius: 0,
                        outline: isActive
                          ? "2px solid oklch(0.20 0 0)"
                          : "none",
                        outlineOffset: -2,
                      }}
                      title={`${e.customer_name} · ${fmtHM(e.clock_in)}–${
                        e.clock_out ? fmtHM(e.clock_out) : "now"
                      }`}
                    />
                  );
                })}
                {/* Pause overlays */}
                {techPauses.map((p) => {
                  const s = minsOfDay(p.pause_start);
                  const end = minsOfDay(p.pause_end || new Date().toISOString());
                  const left = Math.max(0, ((s - START) / span) * 100);
                  const width = Math.max(0.3, ((end - s) / span) * 100);
                  return (
                    <div
                      key={p.id}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: left + "%",
                        width: width + "%",
                        background:
                          "repeating-linear-gradient(135deg, oklch(0.20 0 0 / 0.5) 0 3px, transparent 3px 6px)",
                      }}
                      title="Paused"
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">
        {jobTypes.map((jt) => (
          <div key={jt.id} className="flex items-center gap-1.5">
            <div
              style={{
                width: 10,
                height: 10,
                background: jobTypeColors[jt.label] || "oklch(0.70 0.14 200)",
                borderRadius: 0,
              }}
            />
            {jt.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div
            style={{
              width: 10,
              height: 10,
              background:
                "repeating-linear-gradient(135deg, oklch(0.20 0 0 / 0.5) 0 2px, transparent 2px 4px)",
            }}
          />
          Paused
        </div>
      </div>
    </div>
  );
}
