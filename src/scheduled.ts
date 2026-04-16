import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  fetchHcpJobs,
  getCustomerName,
  getJobAddress,
  getJobType,
  getScheduledDate,
  getAssignedEmployeeIds,
} from '@/lib/hcp-client';

function isBusinessHours(date: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');

  const businessDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const isBusinessDay = businessDays.includes(weekday);
  const isBusinessHour = hour >= 6 && hour < 19; // 6 AM to 7 PM

  return isBusinessDay && isBusinessHour;
}

export async function syncHcpJobsScheduled() {
  if (!isBusinessHours(new Date())) {
    console.log('Not business hours, skipping sync');
    return { skipped: true };
  }

  const apiKey = process.env.HCP_API_KEY;
  if (!apiKey) {
    console.error('HCP_API_KEY not configured');
    return { error: 'HCP_API_KEY not configured' };
  }

  try {
    // Get today's date range in CDT
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2024';
    const todayStart = `${year}-${month}-${day}T00:00:00Z`;
    const todayEnd = `${year}-${month}-${day}T23:59:59Z`;

    // Fetch jobs from HCP for today
    const jobs = await fetchHcpJobs(apiKey, {
      scheduled_start_min: todayStart,
      scheduled_start_max: todayEnd,
    });

    // Upsert into hcp_jobs_cache
    for (const job of jobs) {
      const mappedJob = {
        hcp_job_id: job.id,
        job_number: job.job_number || '',
        customer_name: getCustomerName(job),
        job_type: getJobType(job),
        job_address: getJobAddress(job),
        status: job.work_status || null,
        scheduled_date: getScheduledDate(job),
        assigned_employee_ids: getAssignedEmployeeIds(job),
        last_synced_at: new Date().toISOString(),
        raw_data: job,
      };

      await supabaseAdmin
        .from('hcp_jobs_cache')
        .upsert(mappedJob, { onConflict: 'hcp_job_id' });
    }

    console.log(`Synced ${jobs.length} jobs from HCP`);
    return {
      success: true,
      synced_count: jobs.length,
      last_synced_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('HCP sync error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function autoClockOutScheduled() {
  // Get current time in CDT
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  // Create 7:00 PM CDT timestamp
  const clockOutTime = new Date(`${year}-${month}-${day}T19:00:00`);

  try {
    // Find all active/paused time entries without clock out
    const { data: entries, error } = await supabaseAdmin
      .from('time_entries')
      .select('*')
      .in('status', ['active', 'paused'])
      .is('clock_out', null);

    if (error) throw error;
    if (!entries || entries.length === 0) {
      console.log('No active time entries to clock out');
      return { success: true, clocked_out_count: 0 };
    }

    let clockedOutCount = 0;

    for (const entry of entries) {
      // Close any open pause logs
      const { data: pauseLogs } = await supabaseAdmin
        .from('pause_logs')
        .select('*')
        .eq('time_entry_id', entry.id)
        .is('pause_end', null);

      if (pauseLogs) {
        for (const pauseLog of pauseLogs) {
          await supabaseAdmin
            .from('pause_logs')
            .update({ pause_end: clockOutTime.toISOString() })
            .eq('id', pauseLog.id);
        }
      }

      // Calculate total minutes
      const clockInTime = new Date(entry.clock_in);
      const diffMs = clockOutTime.getTime() - clockInTime.getTime();
      let totalMinutes = Math.floor(diffMs / (1000 * 60));

      // Subtract pause time
      if (pauseLogs) {
        for (const pauseLog of pauseLogs) {
          const pauseStart = new Date(pauseLog.pause_start);
          const pauseEnd = new Date(pauseLog.pause_end || clockOutTime.toISOString());
          const pauseMinutes = Math.floor((pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60));
          totalMinutes -= pauseMinutes;
        }
      }

      // Update time entry
      await supabaseAdmin
        .from('time_entries')
        .update({
          clock_out: clockOutTime.toISOString(),
          status: 'completed',
          total_minutes: Math.max(0, totalMinutes),
        })
        .eq('id', entry.id);

      // Log to admin edits
      await supabaseAdmin.from('admin_edits_log').insert({
        time_entry_id: entry.id,
        edited_by: 'System (Auto Clock-Out)',
        field_changed: 'clock_out',
        old_value: null,
        new_value: clockOutTime.toISOString(),
      });

      clockedOutCount++;
    }

    console.log(`Auto clocked out ${clockedOutCount} entries at 7:00 PM CDT`);
    return { success: true, clocked_out_count: clockedOutCount };
  } catch (error) {
    console.error('Auto clock-out error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export const scheduled = async (event: ScheduledEvent, env: unknown, ctx: ExecutionContext) => {
  // Check which cron triggered this
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now));

  // Run auto clock-out at 7PM CDT (cron at 00:00 UTC)
  if (hour === 19) {
    ctx.waitUntil(autoClockOutScheduled());
  } else {
    // Run job sync during other times
    ctx.waitUntil(syncHcpJobsScheduled());
  }
};
