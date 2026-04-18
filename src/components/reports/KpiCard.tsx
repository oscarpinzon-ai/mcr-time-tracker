interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  trend?: string;
  down?: boolean;
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
  trend,
  down,
}: KpiCardProps) {
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
            style={{
              color: down
                ? "var(--util-low)"
                : "var(--util-high)",
            }}
          >
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
