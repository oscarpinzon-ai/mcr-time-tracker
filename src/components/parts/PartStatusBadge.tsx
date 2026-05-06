import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type PartStatus } from "@/lib/types";

const STATUS_COLORS: Record<PartStatus, string> = {
  requested: "bg-slate-200 text-slate-800",
  sent_to_parts: "bg-blue-100 text-blue-800",
  pricing: "bg-amber-100 text-amber-900",
  quoted: "bg-amber-200 text-amber-900",
  approved: "bg-indigo-100 text-indigo-800",
  ordered: "bg-purple-100 text-purple-800",
  shipped: "bg-cyan-100 text-cyan-800",
  received: "bg-emerald-100 text-emerald-800",
  installed: "bg-emerald-200 text-emerald-900",
  backordered: "bg-rose-100 text-rose-800",
  cancelled: "bg-zinc-200 text-zinc-700 line-through",
};

export function PartStatusBadge({ status }: { status: PartStatus }) {
  return (
    <Badge variant="secondary" className={`${STATUS_COLORS[status]} font-semibold`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
