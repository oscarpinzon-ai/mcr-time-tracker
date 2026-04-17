import { createAPIFileRoute } from '@tanstack/react-start/server';
import { performAutoClockOut } from '@/lib/hcp.server';

/**
 * Cloudflare Cron Trigger Handler for auto clock-out
 * Called by wrangler.jsonc cron trigger at 7 PM CDT
 */
export const Route = createAPIFileRoute('/api/scheduled')({
  POST: async () => {
    try {
      console.log('[Cron] Auto clock-out triggered at 7 PM CDT');
      const result = await performAutoClockOut();

      if (result.ok) {
        console.log(`[Cron] Successfully clocked out ${result.clockedOut} entries`);
        return new Response(
          JSON.stringify({
            success: true,
            clockedOut: result.clockedOut,
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('[Cron] Auto clock-out failed:', result.error);
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString(),
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
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
