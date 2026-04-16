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

export const scheduled = async (event: ScheduledEvent, env: unknown, ctx: ExecutionContext) => {
  ctx.waitUntil(syncHcpJobsScheduled());
};
