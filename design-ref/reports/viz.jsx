// Data-viz primitives shared by both variations.
// SVG-first, no chart lib — keeps everything controllable and crisp.

const vizLib = window.MCR_LIB;
const vizFmtDuration = vizLib.fmtDuration;
const vizFmtHM = vizLib.fmtHM;
const vizUtilBand = vizLib.utilizationBand;
const vizSameDay = vizLib.sameDay;

// ─────────────────────────────────────────────────────────────────────────────
// UtilizationBar — horizontal tri-band (red ≤65 / yellow 65–85 / green ≥85)
// ─────────────────────────────────────────────────────────────────────────────
function UtilizationBar({ pct, mode = 'mcr', onClick, label, hours }) {
  const p = Math.min(140, Math.max(0, pct));
  const band = vizUtilBand(pct);
  const editorial = mode === 'editorial';

  const colors = {
    low:  editorial ? 'oklch(0.62 0.16 25)'  : 'oklch(0.62 0.18 25)',
    mid:  editorial ? 'oklch(0.72 0.12 85)'  : 'oklch(0.80 0.14 80)',
    high: editorial ? 'oklch(0.58 0.12 150)' : 'oklch(0.62 0.16 150)',
  };
  const fill = colors[band];

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={editorial
          ? "text-[13px] text-stone-700"
          : "text-[11px] font-semibold uppercase tracking-wider text-neutral-700"
        }>
          {label}
        </span>
        <span className={editorial
          ? "font-serif text-[15px] tabular-nums text-stone-900"
          : "text-[13px] font-bold tabular-nums text-neutral-900"
        }>
          {pct.toFixed(0)}<span className={editorial ? "text-stone-400" : "text-neutral-400"}>%</span>
          <span className={editorial ? "ml-2 text-[11px] text-stone-400" : "ml-2 text-[10px] text-neutral-400"}>
            {hours}
          </span>
        </span>
      </div>

      <div
        className={editorial
          ? "relative h-2 bg-stone-100 rounded-[1px] overflow-hidden"
          : "relative h-3 bg-neutral-100 border border-neutral-200 overflow-hidden"
        }
      >
        {/* Target band markers */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: (65 / 140 * 100) + '%',
            right: (100 - 85 / 140 * 100) + '%',
            background: editorial
              ? 'oklch(0.95 0.02 85)'
              : 'oklch(0.94 0.05 85)',
          }}
        />
        {/* Fill */}
        <div
          className="absolute top-0 bottom-0 left-0 transition-all duration-500 group-hover:brightness-110"
          style={{
            width: (p / 140 * 100) + '%',
            background: fill,
          }}
        />
        {/* 100% tick */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: (100 / 140 * 100) + '%',
            background: editorial ? 'oklch(0.30 0 0 / 0.45)' : 'oklch(0.20 0 0 / 0.6)',
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UtilizationGauge — radial gauge per tech
// ─────────────────────────────────────────────────────────────────────────────
function UtilizationGauge({ pct, mode = 'mcr', label, sub }) {
  const editorial = mode === 'editorial';
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(140, Math.max(0, pct));
  const offset = c - (clamped / 140) * c * 0.75; // 3/4 arc
  const arc = c * 0.75;

  const band = vizUtilBand(pct);
  const fill = {
    low:  'oklch(0.62 0.18 25)',
    mid:  editorial ? 'oklch(0.72 0.12 85)' : 'oklch(0.80 0.14 80)',
    high: 'oklch(0.62 0.16 150)',
  }[band];

  const dashArray = `${arc} ${c}`;
  const dashOffset = arc - (clamped / 140) * arc;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 108, height: 88 }}>
        <svg width="108" height="108" viewBox="0 0 108 108" style={{ transform: 'rotate(135deg)' }}>
          <circle
            cx="54" cy="54" r={r}
            fill="none"
            stroke={editorial ? 'oklch(0.93 0.005 85)' : 'oklch(0.92 0 0)'}
            strokeWidth="8"
            strokeDasharray={dashArray}
            strokeLinecap="butt"
          />
          <circle
            cx="54" cy="54" r={r}
            fill="none"
            stroke={fill}
            strokeWidth="8"
            strokeDasharray={`${(clamped / 140) * arc} ${c}`}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 500ms' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 4 }}>
          <div className={editorial
            ? "font-serif text-2xl tabular-nums text-stone-900"
            : "text-2xl font-bold tabular-nums text-neutral-900"
          }>
            {pct.toFixed(0)}<span className={editorial ? "text-stone-400 text-base" : "text-neutral-400 text-base"}>%</span>
          </div>
        </div>
      </div>
      <div className={editorial
        ? "text-[13px] text-stone-900 mt-1"
        : "text-[11px] font-bold uppercase tracking-wider text-neutral-900 mt-1"
      }>
        {label}
      </div>
      <div className={editorial ? "text-[11px] text-stone-500" : "text-[10px] text-neutral-500 tabular-nums"}>
        {sub}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UtilizationHeatmap — tech × day grid
// ─────────────────────────────────────────────────────────────────────────────
function UtilizationHeatmap({ matrix, mode = 'mcr', onCellClick }) {
  const editorial = mode === 'editorial';
  const days = matrix[0]?.days || [];

  function cellColor(pct) {
    if (pct === 0) return editorial ? 'oklch(0.96 0.003 85)' : 'oklch(0.96 0 0)';
    const band = vizUtilBand(pct);
    const alpha = Math.min(1, 0.25 + pct / 140);
    const hue = band === 'low' ? 25 : band === 'mid' ? 85 : 150;
    const l = 0.92 - Math.min(0.35, pct / 300);
    const c = band === 'mid' ? (editorial ? 0.10 : 0.14) : 0.12;
    return `oklch(${l} ${c} ${hue})`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className={editorial
              ? "text-left text-[11px] text-stone-400 font-normal pr-3 pb-1.5"
              : "text-left text-[10px] uppercase tracking-wider text-neutral-500 pr-3 pb-1"
            }></th>
            {days.map((d, i) => (
              <th
                key={i}
                className={editorial
                  ? "text-[10px] text-stone-400 font-normal pb-1.5 px-[1px] text-center"
                  : "text-[9px] uppercase tracking-wider text-neutral-500 pb-1 px-[1px] text-center"
                }
                style={{ minWidth: 22 }}
              >
                {d.day.getDate()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.id}>
              <td
                className={editorial
                  ? "pr-3 py-[1px] text-[13px] text-stone-700 whitespace-nowrap"
                  : "pr-3 py-[1px] text-[11px] font-semibold uppercase tracking-wider text-neutral-800 whitespace-nowrap"
                }
              >
                {editorial ? row.name : row.initials}
              </td>
              {row.days.map((cell, i) => (
                <td key={i} className="px-[1px] py-[1px]">
                  <div
                    onClick={() => onCellClick && onCellClick(row, cell)}
                    className="cursor-pointer transition-all hover:outline hover:outline-2 hover:outline-black"
                    style={{
                      width: 20,
                      height: 20,
                      background: cellColor(cell.utilization),
                      borderRadius: editorial ? 2 : 0,
                    }}
                    title={`${row.name} · ${cell.day.toLocaleDateString()}: ${cell.utilization.toFixed(0)}%`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JobTypeDonut
// ─────────────────────────────────────────────────────────────────────────────
function JobTypeDonut({ data, mode = 'mcr', size = 200 }) {
  const editorial = mode === 'editorial';
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const r = size / 2 - 18;
  const inner = r - 22;
  const cx = size / 2;
  const cy = size / 2;

  const palette = editorial
    ? ['oklch(0.55 0.10 85)',  'oklch(0.55 0.10 150)', 'oklch(0.55 0.10 250)']
    : ['oklch(0.80 0.14 80)',  'oklch(0.60 0.14 150)', 'oklch(0.45 0.10 250)'];

  let cum = 0;
  const paths = data.map((d, i) => {
    const frac = total > 0 ? d.minutes / total : 0;
    const a0 = cum * 2 * Math.PI - Math.PI / 2;
    const a1 = (cum + frac) * 2 * Math.PI - Math.PI / 2;
    cum += frac;

    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + inner * Math.cos(a1);
    const y2 = cy + inner * Math.sin(a1);
    const x3 = cx + inner * Math.cos(a0);
    const y3 = cy + inner * Math.sin(a0);

    const path = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`;
    return { path, color: palette[i % palette.length], frac, d };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.path}
            fill={p.color}
            className="transition-opacity hover:opacity-80"
          />
        ))}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          className={editorial ? "font-serif" : "font-bold"}
          style={{
            fontSize: editorial ? 28 : 24,
            fill: 'oklch(0.20 0 0)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(total / 60)}<tspan style={{ fontSize: 14, fill: 'oklch(0.55 0 0)' }}>h</tspan>
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          style={{
            fontSize: 10,
            fill: 'oklch(0.45 0 0)',
            letterSpacing: editorial ? 0 : '0.08em',
            textTransform: editorial ? 'none' : 'uppercase',
          }}
        >
          {editorial ? 'total tracked' : 'TOTAL TRACKED'}
        </text>
      </svg>

      <div className="flex-1 space-y-3">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              style={{
                width: editorial ? 10 : 12,
                height: editorial ? 10 : 12,
                background: p.color,
                borderRadius: editorial ? 2 : 0,
                flexShrink: 0,
              }}
            />
            <div className="flex-1 min-w-0">
              <div className={editorial
                ? "text-[13px] text-stone-800"
                : "text-[11px] font-semibold uppercase tracking-wider text-neutral-900"
              }>
                {p.d.label}
              </div>
              <div className={editorial
                ? "text-[11px] text-stone-500 tabular-nums"
                : "text-[10px] text-neutral-500 tabular-nums"
              }>
                {vizFmtDuration(p.d.minutes)} · {p.d.jobs} jobs
              </div>
            </div>
            <div className={editorial
              ? "font-serif text-[15px] tabular-nums text-stone-900"
              : "text-[13px] font-bold tabular-nums text-neutral-900"
            }>
              {(p.frac * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayTimeline — per-tech Gantt bars (6am–8pm)
// ─────────────────────────────────────────────────────────────────────────────
function DayTimeline({ techs, entries, pauses, jobTypes, mode = 'mcr', day, onEntryClick }) {
  const editorial = mode === 'editorial';
  const START = 6 * 60; // 6:00
  const END = 20 * 60;  // 8:00 pm
  const span = END - START;

  const jobTypeColors = editorial
    ? { service: 'oklch(0.60 0.10 85)', yard: 'oklch(0.55 0.10 150)', installation: 'oklch(0.50 0.10 250)' }
    : { service: 'oklch(0.80 0.14 80)', yard: 'oklch(0.60 0.14 150)', installation: 'oklch(0.45 0.10 250)' };

  const hourTicks = [];
  for (let h = 6; h <= 20; h += 2) hourTicks.push(h);

  function minsOfDay(d) {
    return d.getHours() * 60 + d.getMinutes();
  }

  return (
    <div>
      {/* Axis */}
      <div className="relative ml-24 mb-2" style={{ height: 16 }}>
        {hourTicks.map((h) => {
          const x = ((h * 60 - START) / span) * 100;
          return (
            <div
              key={h}
              className="absolute top-0"
              style={{ left: x + '%' }}
            >
              <div
                className={editorial ? "w-px h-2 bg-stone-300" : "w-px h-2 bg-neutral-300"}
              />
              <div
                className={editorial
                  ? "text-[10px] text-stone-400 -translate-x-1/2 mt-0.5 tabular-nums"
                  : "text-[9px] text-neutral-500 -translate-x-1/2 mt-0.5 tabular-nums uppercase tracking-wide"
                }
              >
                {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {techs.map((tech) => {
          const techEntries = entries.filter(
            (e) => e.employee_id === tech.id && vizSameDay(e.day, day)
          );
          const techPauses = pauses.filter(
            (p) => techEntries.some((e) => e.id === p.entry_id)
          );

          return (
            <div key={tech.id} className="flex items-center">
              <div
                className={editorial
                  ? "w-24 pr-3 text-[13px] text-stone-800 whitespace-nowrap overflow-hidden text-ellipsis"
                  : "w-24 pr-3 text-[11px] font-bold uppercase tracking-wider text-neutral-900 whitespace-nowrap overflow-hidden text-ellipsis"
                }
              >
                {editorial ? tech.name : tech.initials + ' ' + tech.name.split(' ')[1]}
              </div>
              <div
                className={editorial
                  ? "relative flex-1 h-7 bg-stone-50 rounded-sm"
                  : "relative flex-1 h-7 bg-neutral-100 border border-neutral-200"
                }
              >
                {/* Hour grid */}
                {hourTicks.map((h) => {
                  const x = ((h * 60 - START) / span) * 100;
                  return (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px pointer-events-none"
                      style={{
                        left: x + '%',
                        background: editorial ? 'oklch(0.93 0.003 85)' : 'oklch(0.90 0 0)',
                      }}
                    />
                  );
                })}
                {/* Job bars */}
                {techEntries.map((e) => {
                  const s = minsOfDay(e.clock_in);
                  const end = e.clock_out ? minsOfDay(e.clock_out) : minsOfDay(new Date());
                  const left = Math.max(0, (s - START) / span * 100);
                  const width = Math.max(0.5, (end - s) / span * 100);
                  const isActive = !e.clock_out;
                  return (
                    <div
                      key={e.id}
                      onClick={() => onEntryClick && onEntryClick(e)}
                      className="absolute top-0 bottom-0 cursor-pointer transition-all hover:brightness-110 hover:z-10"
                      style={{
                        left: left + '%',
                        width: width + '%',
                        background: jobTypeColors[e.job_type],
                        borderRadius: editorial ? 3 : 0,
                        outline: isActive ? '2px solid oklch(0.20 0 0)' : 'none',
                        outlineOffset: -2,
                      }}
                      title={`${e.customer_name} · ${vizFmtHM(e.clock_in)}–${e.clock_out ? vizFmtHM(e.clock_out) : 'now'}`}
                    />
                  );
                })}
                {/* Pause overlays */}
                {techPauses.map((p) => {
                  const s = minsOfDay(p.pause_start);
                  const end = minsOfDay(p.pause_end);
                  const left = Math.max(0, (s - START) / span * 100);
                  const width = Math.max(0.3, (end - s) / span * 100);
                  return (
                    <div
                      key={p.id}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: left + '%',
                        width: width + '%',
                        background: 'repeating-linear-gradient(135deg, oklch(0.20 0 0 / 0.5) 0 3px, transparent 3px 6px)',
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
      <div className={editorial
        ? "flex items-center gap-5 mt-5 text-[11px] text-stone-500"
        : "flex items-center gap-5 mt-4 text-[10px] uppercase tracking-wider text-neutral-600 font-semibold"
      }>
        {jobTypes.map((jt) => (
          <div key={jt.id} className="flex items-center gap-1.5">
            <div
              style={{
                width: 10, height: 10,
                background: jobTypeColors[jt.id],
                borderRadius: editorial ? 2 : 0,
              }}
            />
            {editorial ? jt.label : jt.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div
            style={{
              width: 10, height: 10,
              background: 'repeating-linear-gradient(135deg, oklch(0.20 0 0 / 0.5) 0 2px, transparent 2px 4px)',
            }}
          />
          Paused
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  UtilizationBar,
  UtilizationGauge,
  UtilizationHeatmap,
  JobTypeDonut,
  DayTimeline,
});
