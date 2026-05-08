import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { MCRLogo } from "@/components/MCRLogo";
import { WorkOrderLookup } from "@/components/parts/WorkOrderLookup";
import { WorkOrderTable } from "@/components/parts/WorkOrderTable";
import { DepartmentSelector } from "@/components/parts/DepartmentSelector";
import { Input } from "@/components/ui/input";
import { listWorkOrders } from "@/lib/parts.functions";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrder, Part } from "@/lib/types";

export const Route = createFileRoute("/")({
  loader: () => { throw redirect({ to: "/revenue" }); },
  head: () => ({
    meta: [
      { title: "MCR Parts Tracker" },
      {
        name: "description",
        content:
          "Track parts needed for HouseCall Pro Jobs and Estimates. Dispatch and Parts collaborate from request to install.",
      },
      { property: "og:title", content: "MCR Parts Tracker" },
      {
        property: "og:description",
        content: "Parts tracking dashboard for Modern Compactor Repair.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    const res = await listWorkOrders();
    setWorkOrders((res.workOrders ?? []) as unknown as WorkOrder[]);
    setParts((res.parts ?? []) as unknown as Part[]);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? workOrders.filter(
        (w) =>
          w.number.toLowerCase().includes(term) ||
          (w.customer_name ?? "").toLowerCase().includes(term) ||
          (w.address ?? "").toLowerCase().includes(term),
      )
    : workOrders;

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
        <div className="max-w-6xl mx-auto space-y-6">
          <WorkOrderLookup onImported={reload} />

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold uppercase tracking-tight">Active work orders</h2>
            <Input
              className="max-w-xs"
              placeholder="Search number, customer, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <WorkOrderTable workOrders={filtered} parts={parts} />
        </div>
      </main>
    </div>
  );
}
