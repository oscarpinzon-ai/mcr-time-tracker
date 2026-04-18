import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MCRLogo } from "@/components/MCRLogo";
import { HardHat, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MCR Tech Performance Tool" },
      {
        name: "description",
        content:
          "Modern Compactor Repair technician time tracking — clock in, pause, and report job time from the field.",
      },
      { property: "og:title", content: "MCR Tech Performance Tool" },
      {
        property: "og:description",
        content: "Technician time tracking for Modern Compactor Repair.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-primary text-primary-foreground py-5 px-6 flex items-center justify-center border-b-4 border-accent">
        <MCRLogo className="h-9" variant="light" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-accent font-semibold tracking-[0.2em] uppercase text-xs mb-3">
              Modern Compactor Repair
            </p>
            <h1 className="text-5xl md:text-6xl font-bold uppercase tracking-tight text-foreground">
              Tech Performance Tool
            </h1>
            <p className="mt-4 text-muted-foreground text-lg">
              Select your role to get started.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Link to="/technician?fresh=1" className="group">
              <div className="bg-card rounded-xl border border-border p-8 shadow-card hover:shadow-card-lg hover:border-accent transition-all h-full flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-xl bg-accent/15 flex items-center justify-center mb-4 group-hover:bg-accent/25 transition-colors">
                  <HardHat className="w-8 h-8 text-accent" strokeWidth={2.2} />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tight">
                  I'm a Technician
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  View your jobs and track time on-site.
                </p>
                <Button variant="default" size="lg" className="mt-6 w-full bg-primary hover:bg-primary/90 h-12 text-base font-semibold">
                  Continue
                </Button>
              </div>
            </Link>

            <Link to="/admin" className="group">
              <div className="bg-card rounded-xl border border-border p-8 shadow-card hover:shadow-card-lg hover:border-accent transition-all h-full flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <LayoutDashboard className="w-8 h-8 text-primary" strokeWidth={2.2} />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tight">
                  I'm a Manager
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Live view, time entries, and reports.
                </p>
                <Button size="lg" className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-semibold">
                  Open Dashboard
                </Button>
              </div>
            </Link>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-10">
            Austin, Texas · Compactor repair &amp; installation
          </p>
        </div>
      </main>
    </div>
  );
}
