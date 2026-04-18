import { fmtDuration, type JobTypeAggregate } from "@/lib/reports";

interface JobTypeDonutProps {
  data: JobTypeAggregate[];
  size?: number;
}

export function JobTypeDonut({ data, size = 200 }: JobTypeDonutProps) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const r = size / 2 - 18;
  const inner = r - 22;
  const cx = size / 2;
  const cy = size / 2;

  const palette = [
    "var(--util-mid)",
    "var(--util-high)",
    "oklch(0.45 0.10 250)",
  ];

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
    return {
      path,
      color: palette[i % palette.length],
      frac,
      d,
    };
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
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="font-bold"
          style={{
            fontSize: 24,
            fill: "oklch(0.20 0 0)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(total / 60)}
          <tspan style={{ fontSize: 14, fill: "oklch(0.55 0 0)" }}>h</tspan>
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          style={{
            fontSize: 10,
            fill: "oklch(0.45 0 0)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          TOTAL TRACKED
        </text>
      </svg>

      <div className="flex-1 space-y-3">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              style={{
                width: 12,
                height: 12,
                background: p.color,
                borderRadius: 0,
                flexShrink: 0,
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-900">
                {p.d.label}
              </div>
              <div className="text-[10px] text-neutral-500 tabular-nums">
                {fmtDuration(p.d.minutes)} · {p.d.jobs} jobs
              </div>
            </div>
            <div className="text-[13px] font-bold tabular-nums text-neutral-900">
              {(p.frac * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
