import { utilizationBand } from "@/lib/reports";

interface UtilizationBarProps {
  pct: number;
  label: string;
  hours: string;
  onClick?: () => void;
}

export function UtilizationBar({
  pct,
  label,
  hours,
  onClick,
}: UtilizationBarProps) {
  const p = Math.min(140, Math.max(0, pct));
  const band = utilizationBand(pct);

  const bandColors = {
    low: "var(--util-low)",
    mid: "var(--util-mid)",
    high: "var(--util-high)",
  };

  const fill = bandColors[band];

  return (
    <div onClick={onClick} className="group cursor-pointer">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-700">
          {label}
        </span>
        <span className="text-[13px] font-bold tabular-nums text-neutral-900">
          {pct.toFixed(0)}
          <span className="text-neutral-400">%</span>
          <span className="ml-2 text-[10px] text-neutral-400">{hours}</span>
        </span>
      </div>

      <div className="relative h-3 bg-neutral-100 border border-neutral-200 overflow-hidden">
        {/* Target band markers */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: (65 / 140) * 100 + "%",
            right: (100 - (85 / 140) * 100) + "%",
            background: "oklch(0.94 0.05 85)",
          }}
        />
        {/* Fill */}
        <div
          className="absolute top-0 bottom-0 left-0 transition-all duration-500 group-hover:brightness-110"
          style={{
            width: (p / 140) * 100 + "%",
            background: fill,
          }}
        />
        {/* 100% tick */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: (100 / 140) * 100 + "%",
            background: "oklch(0.20 0 0 / 0.6)",
          }}
        />
      </div>
    </div>
  );
}
