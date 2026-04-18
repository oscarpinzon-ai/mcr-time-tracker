import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MCRLogo } from "@/components/MCRLogo";
import { ArrowLeft, Activity, Clock, BarChart3, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveView } from "@/components/admin/LiveView";
import { TimeEntriesTab } from "@/components/admin/TimeEntriesTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { EmployeesTab } from "@/components/admin/EmployeesTab";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — MCR Tech Performance Tool" },
      {
        name: "description",
        content: "Live technician status, time entries, and labor reports for MCR.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground border-b-4 border-accent">
        <div className="px-6 py-3 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <div className="h-6 w-px bg-primary-foreground/20" />
            <MCRLogo className="h-7" variant="light" />
            <div className="hidden md:block">
              <div className="text-[10px] uppercase tracking-widest text-accent font-bold">
                Tech Performance Tool
              </div>
              <div className="text-sm font-semibold">Admin Dashboard</div>
            </div>
          </div>
          <div className="text-right text-xs sm:text-sm font-mono tabular-nums text-primary-foreground/80">
            {now
              ? `${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Chicago" })} CDT`
              : ""}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Tabs defaultValue="reports">
          <TabsList className="bg-card border border-border h-auto p-1 mb-5 w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="live" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-1.5 px-4 py-2 font-semibold">
              <Activity className="w-4 h-4" /> Live View
            </TabsTrigger>
            <TabsTrigger value="entries" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-1.5 px-4 py-2 font-semibold">
              <Clock className="w-4 h-4" /> Time Entries
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-1.5 px-4 py-2 font-semibold">
              <BarChart3 className="w-4 h-4" /> Reports
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-1.5 px-4 py-2 font-semibold">
              <Users className="w-4 h-4" /> Employees
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live"><LiveView /></TabsContent>
          <TabsContent value="entries"><TimeEntriesTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
