import { utilizationBand, type TechDayMatrix, type DayCell } from "@/lib/reports";

interface UtilizationHeatmapProps {
  matrix: TechDayMatrix[];
  onCellClick?: (row: TechDayMatrix, cell: DayCell) => void;
}

export function UtilizationHeatmap({
  matrix,
  onCellClick,
}: UtilizationHeatmapProps) {
  const days = matrix[0]?.days || [];

  function cellColor(pct: number): string {
    if (pct === 0) return "oklch(0.96 0 0)";
    const band = utilizationBand(pct);
    const hueMap: Record<"low" | "mid" | "high", number> = {
      low: 25,
      mid: 80,
      high: 150,
    };
    const hue = hueMap[band];
    const alpha = Math.min(1, 0.25 + pct / 140);
    const l = 0.92 - Math.min(0.35, pct / 300);
    const c = 0.14;
    return `oklch(${l} ${c} ${hue})`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[10px] uppercase tracking-wider text-neutral-500 pr-3 pb-1"></th>
            {days.map((d, i) => (
              <th
                key={i}
                className="text-[9px] uppercase tracking-wider text-neutral-500 pb-1 px-[1px] text-center"
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
              <td className="pr-3 py-[1px] text-[11px] font-semibold uppercase tracking-wider text-neutral-800 whitespace-nowrap">
                {row.initials}
              </td>
              {row.days.map((cell, i) => (
                <td key={i} className="px-[1px] py-[1px]">
                  <div
                    onClick={() => onCellClick?.(row, cell)}
                    className="cursor-pointer transition-all hover:outline hover:outline-2 hover:outline-black"
                    style={{
                      width: 20,
                      height: 20,
                      background: cellColor(cell.utilization),
                      borderRadius: 0,
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
