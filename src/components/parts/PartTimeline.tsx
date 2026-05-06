import { Badge } from "@/components/ui/badge";
import type { PartEvent } from "@/lib/types";
import { STATUS_LABELS, type PartStatus } from "@/lib/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function deptColor(dept: string) {
  if (dept === "dispatch") return "bg-blue-100 text-blue-800";
  if (dept === "parts") return "bg-amber-100 text-amber-900";
  if (dept === "system") return "bg-slate-100 text-slate-700";
  return "bg-zinc-100 text-zinc-700";
}

export function PartTimeline({ events }: { events: PartEvent[] }) {
  if (!events.length) {
    return <p className="text-xs text-muted-foreground italic">No activity yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="text-sm border-l-2 border-border pl-3 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={`${deptColor(e.department)} text-xs`}>
              {e.department}
            </Badge>
            {e.author && <span className="font-medium text-xs">{e.author}</span>}
            <span className="text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
          </div>
          <p className="mt-1">
            {e.event_type === "status_change" && e.from_status && e.to_status ? (
              <span>
                Status: <strong>{STATUS_LABELS[e.from_status as PartStatus] ?? e.from_status}</strong>{" "}
                → <strong>{STATUS_LABELS[e.to_status as PartStatus] ?? e.to_status}</strong>
              </span>
            ) : (
              e.message || e.event_type
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
