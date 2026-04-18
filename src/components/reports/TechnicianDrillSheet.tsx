import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X } from "lucide-react";
import { fmtDuration, fmtHM, utilizationBand, workedMinutes } from "@/lib/reports";
import type { TimeEntry, PauseLog } from "@/lib/types";

interface TechnicianDrillSheetProps {
  tech: {
    id: string;
    name: string;
    minutes: number;
    jobs: number;
    daysWorked: number;
    utilization: number;
    entries: TimeEntry[];
  } | null;
  entries: TimeEntry[];
  pauses: PauseLog[];
  jobTypes: Array<{ id: string; label: string }>;
  onClose: () => void;
}

export function TechnicianDrillSheet({
  tech,
  entries,
  pauses,
  jobTypes,
  onClose,
}: TechnicianDrillSheetProps) {
  if (!tech) return null;

  const techEntries = entries
    .filter((e) => e.employee_id === tech.id)
    .sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime());

  const jobTypeMap = Object.fromEntries(
    jobTypes.map((jt) => [jt.id, jt])
  );

  // Group by day
  const byDay = new Map<string, TimeEntry[]>();
  techEntries.forEach((e) => {
    const k = new Date(e.clock_in).toDateString();
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  });

  const band = utilizationBand(tech.utilization);
  const bandColorMap = {
    low: "var(--util-low)",
    mid: "var(--util-mid)",
    high: "var(--util-high)",
  };
  const bandColor = bandColorMap[band];

  const jobTypeColors: Record<string, string> = {
    "Service Call / Repair": "var(--util-mid)",
    "Yard Work": "var(--util-high)",
    "Installation / Removal": "oklch(0.45 0.10 250)",
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "oklch(0.20 0 0 / 0.35)" }}
      />
      {/* Panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 bg-white border-l-4 shadow-2xl overflow-y-auto"
        style={{
          width: "min(560px, 100vw)",
          borderLeftColor: bandColor,
          animation: "slideIn 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <header className="sticky top-0 bg-black text-white px-6 py-4 z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-yellow-400 mb-1 font-semibold">
                TECHNICIAN
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wide">
                {tech.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-yellow-400 text-xl leading-none p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* KPI strip */}
        <div
          className="grid grid-cols-3 gap-4 px-6 py-5 border-b border-neutral-200 bg-neutral-50"
        >
          <Stat label="Utilization" value={tech.utilization.toFixed(0) + "%"} color={bandColor} />
          <Stat label="Hours" value={fmtDuration(tech.minutes)} />
          <Stat label="Jobs" value={String(tech.jobs)} />
        </div>

        {/* Days list */}
        <div className="px-6 py-5 space-y-6">
          {Array.from(byDay.entries()).map(([k, dayEntries]) => {
            const mins = dayEntries.reduce(
              (s, e) => s + workedMinutes(e, pauses),
              0
            );
            return (
              <section key={k}>
                <header className="flex items-baseline justify-between mb-2 pb-1 border-b border-neutral-200">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-900">
                    {dayEntries[0] &&
                      new Date(dayEntries[0].clock_in).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                  </div>
                  <div className="text-[11px] text-neutral-600 tabular-nums font-semibold">
                    {fmtDuration(mins)}
                  </div>
                </header>
                <ul className="space-y-2">
                  {dayEntries.map((e) => {
                    const jt = jobTypeMap[e.job_type ?? ""];
                    const mins = workedMinutes(e, pauses);
                    const jtColor = jobTypeColors[e.job_type ?? ""] || "oklch(0.70 0.14 200)";

                    return (
                      <li
                        key={e.id}
                        className="flex items-start gap-3 p-2 bg-neutral-50 border border-neutral-200"
                      >
                        <div
                          className="mt-1 flex-shrink-0"
                          style={{
                            width: 4,
                            height: 40,
                            background: jtColor,
                            borderRadius: 0,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-[12px] font-bold uppercase tracking-wide text-neutral-900">
                              {e.customer_name}
                            </div>
                            <div className="text-[11px] text-neutral-700 tabular-nums font-semibold whitespace-nowrap">
                              {fmtDuration(mins)}
                            </div>
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider">
                            {jt?.label} · {e.job_number} ·{" "}
                            {fmtHM(e.clock_in)}–
                            {e.clock_out ? fmtHM(e.clock_out) : "active"}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {e.job_address}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}

interface StatProps {
  label: string;
  value: string;
  color?: string;
}

function Stat({ label, value, color }: StatProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
        {label}
      </div>
      <div
        className="text-xl font-bold tabular-nums"
        style={{ color: color || "oklch(0.18 0 0)" }}
      >
        {value}
      </div>
    </div>
  );
}
