import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/**
 * Server-only function for auto clock-out at 7 PM CDT
 */
export async function performAutoClockOut(): Promise<
  { success: true; clockedOut: number } | { success: false; error: string }
> {
  try {
    console.log('[Cron] Auto clock-out triggered at 7 PM CDT');

    // Get server-side Supabase client
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase env vars missing on server');
    }

    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get 7 PM CDT time for today
    const get7pmCDT = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      const dateStr = `${year}-${month}-${day}T19:00:00Z`;
      return new Date(dateStr);
    };

    const clockOutTime = get7pmCDT().toISOString();

    // Find all active/paused entries with no clock_out
    const { data: entries, error: fetchErr } = await supabase
      .from('time_entries')
      .select('id, clock_in, total_minutes')
      .in('status', ['active', 'paused'])
      .is('clock_out', null);

    if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);

    let clockedOut = 0;

    for (const entry of entries ?? []) {
      // Close any open pause logs
      await supabase
        .from('pause_logs')
        .update({ pause_end: clockOutTime })
        .eq('time_entry_id', entry.id)
        .is('pause_end', null);

      // Calculate total minutes
      const clockInTime = new Date(entry.clock_in);
      const clockOutDate = new Date(clockOutTime);
      const totalMinutes = Math.floor(
        (clockOutDate.getTime() - clockInTime.getTime()) / 60000
      );

      // Update time entry
      const { error: updateErr } = await supabase
        .from('time_entries')
        .update({
          clock_out: clockOutTime,
          status: 'completed',
          total_minutes: totalMinutes,
        })
        .eq('id', entry.id);

      if (!updateErr) {
        // Log the edit
        await supabase.from('admin_edits_log').insert({
          time_entry_id: entry.id,
          edited_by: 'System (Auto Clock-Out)',
          field_changed: 'clock_out',
          old_value: null,
          new_value: clockOutTime,
        });
        clockedOut++;
      }
    }

    console.log(`[Cron] Successfully clocked out ${clockedOut} entries`);
    return { success: true, clockedOut };
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
