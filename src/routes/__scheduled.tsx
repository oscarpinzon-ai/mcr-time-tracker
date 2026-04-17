import { createAPIFileRoute } from '@tanstack/react-start/server';
import { autoClockOutFn } from '@/routes/api/scheduled';

/**
 * Cloudflare Cron Trigger Handler
 * Configured in wrangler.jsonc to run daily at 7:00 PM CDT (00:00 UTC next day)
 */
export const Route = createAPIFileRoute('/__scheduled')({
  POST: async () => {
    try {
      const result = await autoClockOutFn();

      return new Response(
        JSON.stringify({
          success: result.ok,
          ...(result.ok ? { clockedOut: result.clockedOut } : { error: result.error }),
          timestamp: new Date().toISOString(),
        }),
        {
          status: result.ok ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('[Cron] Unexpected error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
});
