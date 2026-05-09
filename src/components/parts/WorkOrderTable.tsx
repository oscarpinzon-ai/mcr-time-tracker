import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wrench } from "lucide-react";
import type { WorkOrder, Part } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

export function WorkOrderTable({
  workOrders,
  parts,
}: {
  workOrders: WorkOrder[];
  parts: Pick<Part, "id" | "work_order_id" | "status">[];
}) {
  const partsByOrder = new Map<string, Pick<Part, "status">[]>();
  for (const p of parts) {
    const arr = partsByOrder.get(p.work_order_id) ?? [];
    arr.push(p);
    partsByOrder.set(p.work_order_id, arr);
  }

  if (!workOrders.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Wrench className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No work orders yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Look up a Job or Estimate above to start tracking parts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {workOrders.map((wo) => {
        const wp = partsByOrder.get(wo.id) ?? [];
        const counts = wp.reduce<Record<string, number>>((acc, p) => {
          acc[p.status] = (acc[p.status] ?? 0) + 1;
          return acc;
        }, {});
        return (
          <Card key={wo.id} className="hover:border-accent transition-colors">
            <CardContent className="py-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-56">
                <div className="flex items-center gap-2">
                  <Badge variant={wo.hcp_type === "job" ? "default" : "secondary"}>
                    {wo.hcp_type === "job" ? "Job" : "Estimate"}
                  </Badge>
                  <span className="font-bold text-lg">#{wo.number}</span>
                  {wo.hcp_status && (
                    <span className="text-xs text-muted-foreground">· {wo.hcp_status}</span>
                  )}
                </div>
                {wo.job_site_name ? (
                  <p className="text-sm font-semibold mt-1">{wo.job_site_name}</p>
                ) : (
                  <p className="text-sm font-medium mt-1">{wo.customer_name || "—"}</p>
                )}
                {(wo.work_order_number || wo.purchase_order_number) && (
                  <div className="flex gap-3 mt-0.5">
                    {wo.work_order_number && (
                      <span className="text-xs text-muted-foreground">
                        WO# <span className="text-foreground font-medium">{wo.work_order_number}</span>
                      </span>
                    )}
                    {wo.purchase_order_number && (
                      <span className="text-xs text-muted-foreground">
                        PO# <span className="text-foreground font-medium">{wo.purchase_order_number}</span>
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{wo.address || ""}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 max-w-md">
                {wp.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No parts yet</span>
                ) : (
                  Object.entries(counts).map(([status, n]) => (
                    <Badge key={status} variant="outline" className="text-xs">
                      {n} {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
                    </Badge>
                  ))
                )}
              </div>
              <Link to="/work-orders/$id" params={{ id: wo.id }}>
                <Button size="sm" variant="outline">
                  Open <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
