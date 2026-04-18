// Variation A — "Shop Floor": industrial MCR evolved.
// Header negro + banda amarilla, denso, headers uppercase tracked, bordes 2px.

const vaLib = window.MCR_LIB;

function ShopFloor({ vizType, filters, setFilters, onDrillDown, tickSeconds }) {
  const { TECHS, JOB_TYPES, entries: allEntries, pauses, TODAY, workdays } = window.MCR_DATA;

  const entries = vaLib.applyFilters(allEntries, filters.techs, filters.jobTypes);
  const byTech = vaLib.aggregateByTech(entries, pauses, TECHS);
  const byJobType = vaLib.aggregateByJobType(entries, pauses, JOB_TYPES);
  const byDay = vaLib.aggregateByDay(entries, pauses, TECHS);
  const matrix = vaLib.techDayMatrix(entries, pauses, TECHS, workdays);

  const totalMinutes = byTech.reduce((s, t) => s + t.minutes, 0);
  const totalJobs = entries.length;
  const activeTechs = byTech.filter((t) => t.daysWorked > 0).length;
  const crewUtilization = byTech.filter((t) => t.daysWorked > 0).reduce(
    (s, t) => s + t.utilization, 0
  ) / Math.max(1, activeTechs);

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="bg-black text-white">
        <div className="px-6 md:px-8 py-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center font-black text-black"
              style={{ background: 'oklch(0.80 0.14 80)' }}
            >
              M
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                Modern Compactor Repair
              </div>
              <div className="text-sm font-bold uppercase tracking-wider">
                Reports
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ml-2">
            {['Live View', 'Time Entries', 'Reports', 'Employees'].map((t, i) => (
              <span
                key={t}
                className={i === 2
                  ? "px-3 py-1.5 bg-white text-black"
                  : "px-3 py-1.5 text-neutral-400 hover:text-white cursor-pointer"
                }
              >
                {t}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <LiveDot />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                Austin · CDT
              </div>
              <div className="text-sm font-bold tabular-nums">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>
        <div className="h-1" style={{ background: 'oklch(0.80 0.14 80)' }} />
      </header>

      <main className="px-6 md:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Title + filters */}
        <section className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold">
              Month to date · April 2026
            </div>
            <h1 className="text-2xl font-black uppercase tracking-wide mt-0.5">
              Crew Performance
            </h1>
          </div>
          <Filters filters={filters} setFilters={setFilters} mode="mcr" />
        </section>

        {/* KPI scorecard */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Crew Utilization" value={crewUtilization.toFixed(0) + '%'} sub="Target: 85%"
               accent="oklch(0.80 0.14 80)" trend="+4.2 vs last month" />
          <Kpi label="Billable Hours" value={vaLib.fmtDuration(totalMinutes).replace('m', '')} sub={activeTechs + ' active techs'}
               trend="+12.8h vs last month" />
          <Kpi label="Jobs Completed" value={String(totalJobs)} sub={(totalJobs / Math.max(1, byDay.length)).toFixed(1) + ' / day'}
               trend="+8 vs last month" />
          <Kpi label="Avg Job Duration" value={vaLib.fmtDuration(totalMinutes / Math.max(1, totalJobs))} sub="Across all types"
               trend="−6m vs last month" down />
        </section>

        {/* Row: Utilization + Donut */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2" title="Utilization by Technician" sub="Click a row for details">
            {vizType === 'bars' && (
              <div className="space-y-4">
                {byTech.map((t) => (
                  <UtilizationBar
                    key={t.id}
                    pct={t.utilization}
                    label={t.name}
                    hours={vaLib.fmtDuration(t.minutes) + ' · ' + t.jobs + ' jobs'}
                    mode="mcr"
                    onClick={() => onDrillDown(t)}
                  />
                ))}
              </div>
            )}
            {vizType === 'gauges' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {byTech.map((t) => (
                  <div key={t.id} onClick={() => onDrillDown(t)} className="cursor-pointer hover:bg-neutral-50 p-2 transition-colors">
                    <UtilizationGauge
                      pct={t.utilization}
                      label={t.name}
                      sub={vaLib.fmtDuration(t.minutes)}
                      mode="mcr"
                    />
                  </div>
                ))}
              </div>
            )}
            {vizType === 'heatmap' && (
              <UtilizationHeatmap
                matrix={matrix}
                mode="mcr"
                onCellClick={(row, cell) => onDrillDown(row)}
              />
            )}
          </Card>

          <Card title="Time by Job Type" sub={vaLib.fmtDuration(totalMinutes) + ' total'}>
            <JobTypeDonut data={byJobType} mode="mcr" size={180} />
          </Card>
        </section>

        {/* Timeline */}
        <Card title={"Today's Timeline · " + vaLib.fmtDateShort(TODAY)}
              sub="Bars show when each tech was on a job · hatched = paused · black outline = active">
          <DayTimeline
            techs={TECHS}
            entries={allEntries}
            pauses={pauses}
            jobTypes={JOB_TYPES}
            day={TODAY}
            mode="mcr"
            onEntryClick={(e) => {
              const t = TECHS.find((x) => x.id === e.employee_id);
              onDrillDown(byTech.find((bt) => bt.id === t.id));
            }}
          />
        </Card>

        {/* Daily breakdown */}
        <Card title="Daily Breakdown" sub="Utilization = hours worked / (techs × 8h)">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">Date</th>
                  <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">Day</th>
                  <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">Techs</th>
                  <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">Jobs</th>
                  <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider font-bold">Hours</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider font-bold">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {byDay.slice().reverse().map((d) => {
                  const band = vaLib.utilizationBand(d.utilization);
                  const color = { low: 'oklch(0.62 0.18 25)', mid: 'oklch(0.80 0.14 80)', high: 'oklch(0.62 0.16 150)' }[band];
                  return (
                    <tr key={d.day.toDateString()} className="border-b border-neutral-200 hover:bg-neutral-50">
                      <td className="py-2 pr-4 font-semibold tabular-nums">{vaLib.fmtDateShort(d.day)}</td>
                      <td className="py-2 pr-4 text-neutral-500 uppercase text-[10px] tracking-wider">{vaLib.fmtDow(d.day)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{d.techCount}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{d.jobs}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-semibold">{vaLib.fmtDuration(d.minutes)}</td>
                      <td className="py-2 w-64">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-neutral-100 border border-neutral-200 overflow-hidden">
                            <div
                              className="h-full"
                              style={{ width: Math.min(100, d.utilization / 140 * 100) + '%', background: color }}
                            />
                          </div>
                          <div className="text-[11px] font-bold tabular-nums w-10 text-right">
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
        </Card>
      </main>
    </div>
  );
}

function Card({ title, sub, className = '', children }) {
  return (
    <section className={"bg-white border-2 border-neutral-200 " + className}>
      <header className="flex items-baseline justify-between px-5 py-3 border-b-2 border-neutral-200">
        <div>
          <h2 className="text-[12px] font-black uppercase tracking-wider">{title}</h2>
          {sub && <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">{sub}</div>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Kpi({ label, value, sub, accent, trend, down }) {
  return (
    <div
      className="bg-white border-2 border-neutral-200 p-4 relative overflow-hidden"
      style={{ borderTop: accent ? `4px solid ${accent}` : undefined }}
    >
      <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">
        {label}
      </div>
      <div className="text-3xl font-black tabular-nums mt-1 leading-none">
        {value}
      </div>
      <div className="flex items-baseline justify-between mt-3 gap-2">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">
          {sub}
        </div>
        {trend && (
          <div
            className="text-[10px] font-bold tabular-nums"
            style={{ color: down ? 'oklch(0.55 0.15 25)' : 'oklch(0.55 0.15 150)' }}
          >
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: 'oklch(0.70 0.18 150)' }}
        />
        <div
          className="absolute inset-0 w-2 h-2 rounded-full animate-ping"
          style={{ background: 'oklch(0.70 0.18 150)' }}
        />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-400">
        Live · 30s
      </div>
    </div>
  );
}

function Filters({ filters, setFilters, mode }) {
  const { TECHS, JOB_TYPES } = window.MCR_DATA;
  const editorial = mode === 'editorial';

  function toggle(arrKey, id) {
    const cur = filters[arrKey];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setFilters({ ...filters, [arrKey]: next });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterDropdown
        label="Technicians"
        count={filters.techs.length}
        options={TECHS.map((t) => ({ id: t.id, label: t.name }))}
        selected={filters.techs}
        onToggle={(id) => toggle('techs', id)}
        onClear={() => setFilters({ ...filters, techs: [] })}
        mode={mode}
      />
      <FilterDropdown
        label="Job types"
        count={filters.jobTypes.length}
        options={JOB_TYPES.map((j) => ({ id: j.id, label: j.label }))}
        selected={filters.jobTypes}
        onToggle={(id) => toggle('jobTypes', id)}
        onClear={() => setFilters({ ...filters, jobTypes: [] })}
        mode={mode}
      />
    </div>
  );
}

function FilterDropdown({ label, count, options, selected, onToggle, onClear, mode }) {
  const [open, setOpen] = React.useState(false);
  const editorial = mode === 'editorial';
  const ref = React.useRef(null);

  React.useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={editorial
          ? "flex items-center gap-2 px-3 py-1.5 border border-stone-300 text-[13px] text-stone-700 hover:border-stone-500 bg-white rounded-sm"
          : "flex items-center gap-2 px-3 py-1.5 border-2 border-neutral-300 text-[11px] uppercase tracking-wider font-bold hover:border-black bg-white"
        }
      >
        {label}
        {count > 0 && (
          <span className={editorial
            ? "inline-flex items-center justify-center bg-stone-900 text-white text-[10px] px-1.5 py-0.5 rounded-sm"
            : "inline-flex items-center justify-center bg-black text-white text-[10px] px-1.5 py-0.5"
          }>
            {count}
          </span>
        )}
        <span className={editorial ? "text-stone-400" : "text-neutral-500"}>▾</span>
      </button>
      {open && (
        <div
          className={editorial
            ? "absolute right-0 top-full mt-1 bg-white border border-stone-200 shadow-lg rounded-sm overflow-hidden z-30 min-w-[220px]"
            : "absolute right-0 top-full mt-1 bg-white border-2 border-black shadow-lg overflow-hidden z-30 min-w-[220px]"
          }
        >
          <div className={editorial
            ? "flex items-center justify-between px-3 py-2 border-b border-stone-100 text-[11px] text-stone-500"
            : "flex items-center justify-between px-3 py-2 border-b border-neutral-200 text-[10px] uppercase tracking-wider font-bold text-neutral-700"
          }>
            <span>{label}</span>
            {count > 0 && (
              <button onClick={onClear} className="underline hover:text-black">Clear</button>
            )}
          </div>
          {options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => onToggle(o.id)}
                className={editorial
                  ? "flex items-center gap-2 w-full px-3 py-2 text-left text-[13px] hover:bg-stone-50"
                  : "flex items-center gap-2 w-full px-3 py-2 text-left text-[12px] hover:bg-neutral-50"
                }
              >
                <span
                  className={editorial
                    ? "inline-block w-4 h-4 border border-stone-300 rounded-sm flex-shrink-0"
                    : "inline-block w-4 h-4 border-2 border-neutral-400 flex-shrink-0"
                  }
                  style={{
                    background: on ? (editorial ? 'oklch(0.20 0 0)' : 'oklch(0.80 0.14 80)') : 'white',
                    borderColor: on ? (editorial ? 'oklch(0.20 0 0)' : 'oklch(0.20 0 0)') : undefined,
                  }}
                >
                  {on && (
                    <svg viewBox="0 0 16 16" fill="none" style={{ width: '100%', height: '100%' }}>
                      <path d="M3 8l3 3 7-7" stroke={editorial ? 'white' : 'black'} strokeWidth="2.5" strokeLinecap="square" />
                    </svg>
                  )}
                </span>
                <span className="flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ShopFloor, Filters, FilterDropdown, Card, Kpi });
