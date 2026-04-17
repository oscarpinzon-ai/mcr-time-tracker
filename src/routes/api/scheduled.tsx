import { createServerFn } from '@tanstack/react-start';
import { performAutoClockOut } from '@/lib/hcp.server';

export const autoClockOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    console.log('[Cron] Auto clock-out triggered at 7 PM CDT');
    const result = await performAutoClockOut();

    if (result.ok) {
      console.log(`[Cron] Successfully clocked out ${result.clockedOut} entries`);
    } else {
      console.error('[Cron] Auto clock-out failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
