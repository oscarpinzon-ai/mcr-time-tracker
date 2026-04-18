// Variation B — "Editorial": refined, fintech-adjacent.
// Serif display face for numbers, hairline rules, more whitespace, subtle accents.

const vbLib = window.MCR_LIB;

function Editorial({ vizType, filters, setFilters, onDrillDown, tickSeconds }) {
  const { TECHS, JOB_TYPES, entries: allEntries, pauses, TODAY, workdays } = window.MCR_DATA;

  const entries = vbLib.applyFilters(allEntries, filters.techs, filters.jobTypes);
  const byTech = vbLib.aggregateByTech(entries, pauses, TECHS);
  const byJobType = vbLib.aggregateByJobType(entries, pauses, JOB_TYPES);
  const byDay = vbLib.aggregateByDay(entries, pauses, TECHS);
  const matrix = vbLib.techDayMatrix(entries, pauses, TECHS, workdays);

  const totalMinutes = byTech.reduce((s, t) => s + t.minutes, 0);
  const totalJobs = entries.length;
  const activeTechs = byTech.filter((t) => t.daysWorked > 0).length;
  const crewUtilization = byTech.filter((t) => t.daysWorked > 0).reduce(
    (s, t) => s + t.utilization, 0
  ) / Math.max(1, activeTechs);

  return (
    <div
      className="min-h-screen text-stone-900"
      style={{
        background: 'oklch(0.985 0.003 85)',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      {/* Header — slim, bone-colored, with hairline rule */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md"
        style={{ background: 'oklch(0.985 0.003 85 / 0.9)' }}
      >
        <div className="px-8 md:px-12 py-5 flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 flex items-center justify-center text-white text-sm"
              style={{ background: 'oklch(0.20 0 0)', borderRadius: 4, fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 }}
            >
              m
            </div>
            <div>
              <div className="text-[11px] text-stone-400">
                Modern Compactor Repair
              </div>
              <div
                className="text-base text-stone-900 leading-tight"
                style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 500 }}
              >
                Reports
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-5 text-[13px] text-stone-500 ml-2">
            {['Live', 'Entries', 'Reports', 'Employees'].map((t, i) => (
              <span
                key={t}
                className={i === 2
                  ? "text-stone-900 border-b border-stone-900 pb-0.5"
                  : "hover:text-stone-900 cursor-pointer"
                }
              >
                {t}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-5">
            <LiveDotEditorial />
            <div className="text-right">
              <div className="text-[10px] text-stone-400">Austin · CDT</div>
              <div className="text-[13px] tabular-nums text-stone-900">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>
        <div className="h-px" style={{ background: 'oklch(0.88 0.005 85)' }} />
      </header>

      <main className="px-8 md:px-12 py-10 max-w-[1440px] mx-auto space-y-12">
        {/* Masthead */}
        <section className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
              April 2026 · Month to date
            </div>
            <h1
              className="text-stone-900 mt-2 leading-[1.05]"
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontWeight: 400,
                fontSize: 44,
                letterSpacing: '-0.02em',
              }}
            >
              How the crew spent <em style={{ fontStyle: 'italic' }}>its month.</em>
            </h1>
            <p className="text-stone-500 text-[14px] mt-2 max-w-lg">
              Eighteen workdays of service calls, yard work, and compactor swaps —
              measured against an 8-hour baseline.
            </p>
          </div>
          <Filters filters={filters} setFilters={setFilters} mode="editorial" />
        </section>

        {/* KPI scorecard — editorial grid */}
        <section
          className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-stone-200"
          style={{ borderTop: '1px solid oklch(0.88 0.005 85)', borderBottom: '1px solid oklch(0.88 0.005 85)' }}
        >
          <KpiEd label="Crew utilization" value={crewUtilization.toFixed(0)} unit="%"
                 sub="8-hour baseline" trend="+4.2" />
          <KpiEd label="Billable hours" value={Math.round(totalMinutes / 60)} unit="h"
                 sub={activeTechs + " techs active"} trend="+12.8" />
          <KpiEd label="Jobs completed" value={totalJobs} unit=""
                 sub={(totalJobs / Math.max(1, byDay.length)).toFixed(1) + ' per day'} trend="+8" />
          <KpiEd label="Average job" value={(totalMinutes / Math.max(1, totalJobs) / 60).toFixed(1)} unit="h"
                 sub="All types blended" trend="−0.1" down />
        </section>

        {/* Two-column data */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-3">
            <SectionHead title="Utilization, by technician"
                         sub="Each technician against the 85% crew target. Click to read the full log." />
            {vizType === 'bars' && (
              <div className="space-y-5 pt-3">
                {byTech.map((t) => (
                  <UtilizationBar
                    key={t.id}
                    pct={t.utilization}
                    label={t.name}
                    hours={vbLib.fmtDuration(t.minutes) + ' · ' + t.jobs + ' jobs'}
                    mode="editorial"
                    onClick={() => onDrillDown(t)}
                  />
                ))}
              </div>
            )}
            {vizType === 'gauges' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-3">
                {byTech.map((t) => (
                  <div key={t.id} onClick={() => onDrillDown(t)} className="cursor-pointer hover:bg-stone-100/50 p-3 rounded-sm transition-colors">
                    <UtilizationGauge
                      pct={t.utilization}
                      label={t.name}
                      sub={vbLib.fmtDuration(t.minutes)}
                      mode="editorial"
                    />
                  </div>
                ))}
              </div>
            )}
            {vizType === 'heatmap' && (
              <div className="pt-3">
                <UtilizationHeatmap
                  matrix={matrix}
                  mode="editorial"
                  onCellClick={(row) => onDrillDown(row)}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-3">
            <SectionHead title="Time, by job type"
                         sub="A month of the crew's attention." />
            <div className="pt-3">
              <JobTypeDonut data={byJobType} mode="editorial" size={180} />
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-3">
          <SectionHead
            title={"Today, hour by hour"}
            sub={vbLib.fmtDateShort(TODAY) + " · bars are jobs; hatched is paused; outlined is still clocked-in"}
          />
          <div className="pt-4">
            <DayTimeline
              techs={TECHS}
              entries={allEntries}
              pauses={pauses}
              jobTypes={JOB_TYPES}
              day={TODAY}
              mode="editorial"
              onEntryClick={(e) => {
                const bt = byTech.find((t) => t.id === e.employee_id);
                onDrillDown(bt);
              }}
            />
          </div>
        </section>

        {/* Daily breakdown */}
        <section className="space-y-3">
          <SectionHead title="Day-by-day"
                       sub="Utilization is hours worked over (techs on duty × 8)." />
          <div className="overflow-x-auto pt-3">
            <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid oklch(0.88 0.005 85)' }}>
                  <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider text-stone-400 font-normal">Date</th>
                  <th className="text-left py-2 pr-4 text-[11px] text-stone-400 font-normal">Day</th>
                  <th className="text-right py-2 pr-4 text-[11px] uppercase tracking-wider text-stone-400 font-normal">Techs</th>
                  <th className="text-right py-2 pr-4 text-[11px] uppercase tracking-wider text-stone-400 font-normal">Jobs</th>
                  <th className="text-right py-2 pr-4 text-[11px] uppercase tracking-wider text-stone-400 font-normal">Hours</th>
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-stone-400 font-normal">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {byDay.slice().reverse().map((d) => {
                  const band = vbLib.utilizationBand(d.utilization);
                  const color = {
                    low: 'oklch(0.62 0.16 25)',
                    mid: 'oklch(0.72 0.12 85)',
                    high: 'oklch(0.58 0.12 150)',
                  }[band];
                  return (
                    <tr
                      key={d.day.toDateString()}
                      className="hover:bg-stone-100/50 transition-colors"
                      style={{ borderBottom: '1px solid oklch(0.93 0.005 85)' }}
                    >
                      <td className="py-3 pr-4 tabular-nums text-stone-900">{vbLib.fmtDateShort(d.day)}</td>
                      <td className="py-3 pr-4 text-stone-500">{d.day.toLocaleDateString('en-US', { weekday: 'long' })}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-stone-700">{d.techCount}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-stone-700">{d.jobs}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-stone-900">{(d.minutes / 60).toFixed(1)}h</td>
                      <td className="py-3 w-80">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: Math.min(100, d.utilization / 140 * 100) + '%', background: color }}
                            />
                          </div>
                          <div className="text-[13px] tabular-nums w-10 text-right text-stone-900" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
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
        </section>
      </main>

      <footer className="px-8 md:px-12 py-8 text-[11px] text-stone-400 border-t border-stone-200">
        MCR · Reports · Figures auto-refresh every 30s · Baseline 8h per tech per workday
      </footer>
    </div>
  );
}

function SectionHead({ title, sub }) {
  return (
    <header>
      <h2
        className="text-stone-900"
        style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 22, fontWeight: 400, letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
      {sub && <p className="text-[12px] text-stone-500 mt-1 max-w-xl">{sub}</p>}
    </header>
  );
}

function KpiEd({ label, value, unit, sub, trend, down }) {
  return (
    <div className="py-6 px-6 first:pl-0 last:pr-0">
      <div className="text-[11px] uppercase tracking-[0.15em] text-stone-400">
        {label}
      </div>
      <div
        className="mt-3 tabular-nums text-stone-900 leading-none"
        style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontSize: 48,
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}
      >
        {value}<span className="text-stone-300 text-[28px]">{unit}</span>
      </div>
      <div className="flex items-baseline justify-between mt-3 gap-2">
        <div className="text-[12px] text-stone-500">{sub}</div>
        {trend && (
          <div
            className="text-[12px] tabular-nums"
            style={{ color: down ? 'oklch(0.55 0.14 25)' : 'oklch(0.52 0.12 150)' }}
          >
            {down ? '↓' : '↑'} {trend}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveDotEditorial() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'oklch(0.58 0.12 150)' }}
        />
        <div
          className="absolute inset-0 w-1.5 h-1.5 rounded-full animate-ping"
          style={{ background: 'oklch(0.58 0.12 150)' }}
        />
      </div>
      <div className="text-[11px] text-stone-500">Updated 30s ago</div>
    </div>
  );
}

Object.assign(window, { Editorial });
