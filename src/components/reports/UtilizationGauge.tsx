import { utilizationBand } from "@/lib/reports";

interface UtilizationGaugeProps {
  pct: number;
  label: string;
  sub: string;
  onClick?: () => void;
}

export function UtilizationGauge({
  pct,
  label,
  sub,
  onClick,
}: UtilizationGaugeProps) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(140, Math.max(0, pct));
  const band = utilizationBand(pct);

  const bandColors = {
    low: "var(--util-low)",
    mid: "var(--util-mid)",
    high: "var(--util-high)",
  };

  const fill = bandColors[band];

  const arc = c * 0.75;
  const dashOffset = arc - (clamped / 140) * arc;
  const dashArray = `${arc} ${c}`;

  return (
    <div
      className="flex flex-col items-center cursor-pointer"
      onClick={onClick}
    >
      <div className="relative" style={{ width: 108, height: 88 }}>
        <svg width="108" height="108" viewBox="0 0 108 108" style={{ transform: "rotate(135deg)" }}>
          <circle
            cx="54"
            cy="54"
            r={r}
            fill="none"
            stroke="oklch(0.92 0 0)"
            strokeWidth="8"
            strokeDasharray={dashArray}
            strokeLinecap="butt"
          />
          <circle
            cx="54"
            cy="54"
            r={r}
            fill="none"
            stroke={fill}
            strokeWidth="8"
            strokeDasharray={`${(clamped / 140) * arc} ${c}`}
            strokeLinecap="butt"
            style={{ transition: "stroke-dasharray 500ms" }}
          />
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ paddingTop: 4 }}
        >
          <div className="text-2xl font-bold tabular-nums text-neutral-900">
            {pct.toFixed(0)}
            <span className="text-neutral-400 text-base">%</span>
          </div>
        </div>
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 mt-1">
        {label}
      </div>
      <div className="text-[10px] text-neutral-500 tabular-nums">{sub}</div>
    </div>
  );
}
