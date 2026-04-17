/**
 * Scheduled event handlers for Cloudflare Workers cron triggers.
 * Runs every 3 minutes and at midnight Mon-Sat for HCP sync and auto clock-out.
 */

import type { ScheduledEvent } from '@cloudflare/workers-types';
import { performHcpJobSync, performAutoClockOut } from '@/lib/hcp.server';

export async function handleScheduled(event: ScheduledEvent) {
  console.log('[Cron] Scheduled event triggered');

  try {
    // Every 3 minutes: sync jobs for today and nearby dates
    const syncResult = await performHcpJobSync();

    if (syncResult.ok) {
      console.log(`[Cron] Synced ${syncResult.upserted} jobs`);
    } else {
      console.error(`[Cron] Job sync failed: ${syncResult.error}`);
    }

    // At midnight: auto clock-out any active entries
    const now = new Date();
    const hour = now.getUTCHours();

    // Midnight is 6 AM UTC (12 AM CDT = 12 AM UTC)
    if (hour === 6) {
      const clockOutResult = await performAutoClockOut();

      if (clockOutResult.ok) {
        console.log(`[Cron] Auto clocked out ${clockOutResult.clockedOut} entries`);
      } else {
        console.error(`[Cron] Auto clock-out failed: ${clockOutResult.error}`);
      }
    }
  } catch (error) {
    console.error('[Cron] Scheduled event error:', error);
  }
}
