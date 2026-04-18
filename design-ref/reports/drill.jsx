// Drill-down side panel — shared by both variations.

const drillLib = window.MCR_LIB;

function DrillDownPanel({ tech, entries, pauses, jobTypes, mode, onClose }) {
  if (!tech) return null;
  const editorial = mode === 'editorial';

  const techEntries = entries
    .filter((e) => e.employee_id === tech.id)
    .sort((a, b) => b.clock_in - a.clock_in);

  const totalMinutes = techEntries.reduce((s, e) => s + drillLib.workedMinutes(e, pauses), 0);
  const jobTypeMap = Object.fromEntries(jobTypes.map((jt) => [jt.id, jt]));

  // Group by day for visual clarity.
  const byDay = new Map();
  techEntries.forEach((e) => {
    const k = e.day.toDateString();
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  });

  const band = drillLib.utilizationBand(tech.utilization);
  const bandColor = {
    low: 'oklch(0.62 0.18 25)',
    mid: editorial ? 'oklch(0.72 0.12 85)' : 'oklch(0.80 0.14 80)',
    high: 'oklch(0.62 0.16 150)',
  }[band];

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: 'oklch(0.20 0 0 / 0.35)' }}
      />
      {/* Panel */}
      <aside
        className={editorial
          ? "fixed top-0 right-0 bottom-0 z-50 bg-white shadow-2xl overflow-y-auto"
          : "fixed top-0 right-0 bottom-0 z-50 bg-white border-l-4 shadow-2xl overflow-y-auto"
        }
        style={{
          width: 'min(560px, 100vw)',
          borderLeftColor: editorial ? 'transparent' : bandColor,
          animation: 'slideIn 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <header className={editorial
          ? "sticky top-0 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-7 py-5 z-10"
          : "sticky top-0 bg-black text-white px-6 py-4 z-10"
        }>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={editorial
                ? "text-[11px] text-stone-400 mb-1"
                : "text-[10px] uppercase tracking-[0.15em] text-yellow-400 mb-1 font-semibold"
              }>
                {editorial ? 'Technician report' : 'TECHNICIAN'}
              </div>
              <h2 className={editorial
                ? "font-serif text-2xl text-stone-900"
                : "text-xl font-bold uppercase tracking-wide"
              }>
                {tech.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={editorial
                ? "text-stone-400 hover:text-stone-900 text-xl leading-none p-1"
                : "text-white hover:text-yellow-400 text-xl leading-none p-1"
              }
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </header>

        {/* KPI strip */}
        <div className={editorial
          ? "grid grid-cols-3 gap-6 px-7 py-6 border-b border-stone-200"
          : "grid grid-cols-3 gap-4 px-6 py-5 border-b border-neutral-200 bg-neutral-50"
        }>
          <Stat label="Utilization" value={tech.utilization.toFixed(0) + '%'} color={bandColor} editorial={editorial} />
          <Stat label="Hours"       value={drillLib.fmtDuration(totalMinutes)} editorial={editorial} />
          <Stat label="Jobs"        value={String(tech.jobs)} editorial={editorial} />
        </div>

        {/* Days list */}
        <div className="px-7 py-5 space-y-6">
          {Array.from(byDay.entries()).map(([k, dayEntries]) => {
            const mins = dayEntries.reduce((s, e) => s + drillLib.workedMinutes(e, pauses), 0);
            return (
              <section key={k}>
                <header className={editorial
                  ? "flex items-baseline justify-between mb-3 pb-1 border-b border-stone-100"
                  : "flex items-baseline justify-between mb-2 pb-1 border-b border-neutral-200"
                }>
                  <div className={editorial
                    ? "text-[13px] font-medium text-stone-900"
                    : "text-[11px] font-bold uppercase tracking-wider text-neutral-900"
                  }>
                    {dayEntries[0].day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  <div className={editorial
                    ? "text-[12px] text-stone-500 tabular-nums"
                    : "text-[11px] text-neutral-600 tabular-nums font-semibold"
                  }>
                    {drillLib.fmtDuration(mins)}
                  </div>
                </header>
                <ul className="space-y-2">
                  {dayEntries.map((e) => {
                    const jt = jobTypeMap[e.job_type];
                    const mins = drillLib.workedMinutes(e, pauses);
                    const jtColor = editorial
                      ? { service: 'oklch(0.60 0.10 85)', yard: 'oklch(0.55 0.10 150)', installation: 'oklch(0.50 0.10 250)' }[e.job_type]
                      : { service: 'oklch(0.80 0.14 80)', yard: 'oklch(0.60 0.14 150)', installation: 'oklch(0.45 0.10 250)' }[e.job_type];
                    return (
                      <li
                        key={e.id}
                        className={editorial
                          ? "flex items-start gap-3 py-2"
                          : "flex items-start gap-3 p-2 bg-neutral-50 border border-neutral-200"
                        }
                      >
                        <div
                          className="mt-1 flex-shrink-0"
                          style={{
                            width: 4, height: 40,
                            background: jtColor,
                            borderRadius: editorial ? 2 : 0,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className={editorial
                              ? "text-[14px] text-stone-900 font-medium"
                              : "text-[12px] font-bold uppercase tracking-wide text-neutral-900"
                            }>
                              {e.customer_name}
                            </div>
                            <div className={editorial
                              ? "text-[12px] text-stone-500 tabular-nums whitespace-nowrap"
                              : "text-[11px] text-neutral-700 tabular-nums font-semibold whitespace-nowrap"
                            }>
                              {drillLib.fmtDuration(mins)}
                            </div>
                          </div>
                          <div className={editorial
                            ? "text-[11px] text-stone-500 mt-0.5"
                            : "text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider"
                          }>
                            {jt?.label} · {e.job_number} · {drillLib.fmtHM(e.clock_in)}–{e.clock_out ? drillLib.fmtHM(e.clock_out) : 'active'}
                          </div>
                          <div className={editorial
                            ? "text-[11px] text-stone-400 mt-0.5"
                            : "text-[10px] text-neutral-500 mt-0.5"
                          }>
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

function Stat({ label, value, color, editorial }) {
  return (
    <div>
      <div className={editorial
        ? "text-[11px] text-stone-400 mb-1"
        : "text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1"
      }>
        {label}
      </div>
      <div
        className={editorial
          ? "font-serif text-2xl tabular-nums"
          : "text-xl font-bold tabular-nums"
        }
        style={{ color: color || (editorial ? 'oklch(0.20 0 0)' : 'oklch(0.18 0 0)') }}
      >
        {value}
      </div>
    </div>
  );
}

window.DrillDownPanel = DrillDownPanel;
