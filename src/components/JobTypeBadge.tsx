import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { label: string; className: string }> = {
  "Service Call / Repair": {
    label: "Service / Repair",
    className: "bg-accent/15 text-accent-foreground border-accent/40",
  },
  "Yard Work": {
    label: "Yard Work",
    className: "bg-success/15 text-foreground border-success/40",
  },
  "Installation / Removal": {
    label: "Install / Removal",
    className: "bg-primary/10 text-primary border-primary/30",
  },
};

export function JobTypeBadge({ type, className }: { type: string | null; className?: string }) {
  if (!type) return null;
  const cfg = map[type] ?? { label: type, className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold uppercase tracking-wide text-[10px] px-2 py-0.5", cfg.className, className)}
    >
      {cfg.label}
    </Badge>
  );
}
