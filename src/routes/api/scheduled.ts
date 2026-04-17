import { createFileRoute } from "@tanstack/react-router";
import { autoClockOut } from "@/lib/hcp.functions";

/**
 * Cloudflare Cron Trigger Handler
 * Configured in wrangler.jsonc to run daily at 7:00 PM CDT (00:00 UTC next day)
 * Cron: "0 0 * * *" (UTC) = 7 PM CDT (America/Chicago)
 */
export const Route = createFileRoute("/api/scheduled")({
  server: {
    handlers: {
      POST: async () => {
        try {
          console.log("[Cron] Auto clock-out triggered at 7 PM CDT");
          const result = await autoClockOut();

          if (result.ok) {
            console.log(`[Cron] Successfully clocked out ${result.clockedOut} entries`);
            return Response.json(
              {
                success: true,
                clockedOut: result.clockedOut,
                timestamp: new Date().toISOString(),
              },
              { status: 200 },
            );
          }

          console.error("[Cron] Auto clock-out failed:", result.error);
          return Response.json(
            {
              success: false,
              error: result.error,
              timestamp: new Date().toISOString(),
            },
            { status: 500 },
          );
        } catch (error) {
          console.error("[Cron] Unexpected error:", error);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date().toISOString(),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
