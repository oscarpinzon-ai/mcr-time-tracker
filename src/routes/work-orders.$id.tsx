import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { MCRLogo } from "@/components/MCRLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DepartmentSelector } from "@/components/parts/DepartmentSelector";
import { AddPartDialog } from "@/components/parts/AddPartDialog";
import { PartCard } from "@/components/parts/PartCard";
import { getWorkOrderDetail, deleteWorkOrder } from "@/lib/parts.functions";
import { refreshWorkOrder } from "@/lib/work-orders.functions";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrder, Part, PartEvent } from "@/lib/types";

export const Route = createFileRoute("/work-orders/$id")({
  head: () => ({
    meta: [{ title: "Work Order — MCR Parts Tracker" }],
  }),
  component: WorkOrderDetail,
  errorComponent: ({ error }) => (
    <div className="p-8">
      <p className="text-destructive">{error.message}</p>
      <Link to="/" className="underline">
        Back to dashboard
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8">
      <p>Work order not found.</p>
      <Link to="/" className="underline">Back</Link>
    </div>
  ),
});

function WorkOrderDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [events, setEvents] = useState<PartEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const res = await getWorkOrderDetail({ data: { id } });
    if (!res.ok) {
      toast.error(res.error);
      setLoading(false);
      return;
    }
    setWorkOrder(res.workOrder as unknown as WorkOrder);
    setParts((res.parts ?? []) as unknown as Part[]);
    setEvents((res.events ?? []) as unknown as PartEvent[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`wo-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "parts", filter: `work_order_id=eq.${id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "part_events" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders", filter: `id=eq.${id}` }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, reload]);

  async function doRefresh() {
    setRefreshing(true);
    const res = await refreshWorkOrder({ data: { id } });
    setRefreshing(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Refreshed from HouseCall Pro");
      reload();
    }
  }

  async function doDelete() {
    if (!workOrder) return;
    if (!confirm(`Delete work order #${workOrder.number} and all parts?`)) return;
    const res = await deleteWorkOrder({ data: { id } });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Deleted");
      router.navigate({ to: "/" });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground py-4 px-6 border-b-4 border-accent flex items-center justify-between gap-4 flex-wrap">
        <Link to="/" className="flex items-center gap-3">
          <MCRLogo className="h-8" variant="light" />
          <span className="font-bold uppercase tracking-tight text-lg">Parts Tracker</span>
        </Link>
        <DepartmentSelector />
      </header>

      <main className="flex-1 px-6 py-8 bg-background">
        <div className="max-w-5xl mx-auto space-y-6">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
          </Link>

          {loading && <p>Loading…</p>}

          {workOrder && (
            <>
              <Card>
                <CardContent className="pt-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={workOrder.hcp_type === "job" ? "default" : "secondary"}>
                        {workOrder.hcp_type === "job" ? "Job" : "Estimate"}
                      </Badge>
                      <h1 className="text-3xl font-bold">#{workOrder.number}</h1>
                      {workOrder.hcp_status && (
                        <Badge variant="outline">{workOrder.hcp_status}</Badge>
                      )}
                    </div>
                    <p className="font-medium mt-2">{workOrder.customer_name || "—"}</p>
                    <p className="text-sm text-muted-foreground">{workOrder.address || ""}</p>
                    {workOrder.scheduled_date && (
                      <p className="text-xs mt-2">
                        Scheduled: <strong>{workOrder.scheduled_date}</strong>
                      </p>
                    )}
                    {workOrder.assigned_to && (
                      <p className="text-xs">
                        Assigned: <strong>{workOrder.assigned_to}</strong>
                      </p>
                    )}
                    {workOrder.description && (
                      <p className="text-sm mt-2 max-w-2xl">{workOrder.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {workOrder.hcp_id && (
                      <Button variant="outline" onClick={doRefresh} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh from HCP
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={doDelete} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-tight">
                  Parts ({parts.length})
                </h2>
                <AddPartDialog workOrderId={id} onAdded={reload} />
              </div>

              {parts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No parts yet. Click <strong>Add part needed</strong> to log the first one.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {parts.map((p) => (
                    <PartCard
                      key={p.id}
                      part={p}
                      events={events.filter((e) => e.part_id === p.id)}
                      onChanged={reload}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
