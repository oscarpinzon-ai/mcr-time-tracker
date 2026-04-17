import { createAPIFileRoute } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  fetchHcpJobs,
  getCustomerName,
  getJobAddress,
  getJobType,
  getScheduledDate,
  getAssignedEmployeeIds,
} from '@/lib/hcp-client';

export const Route = createAPIFileRoute('/__internal/sync-hcp-jobs')({
  POST: async () => {
    const apiKey = process.env.HCP_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HCP_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
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
        const scheduled_date = getScheduledDate(job);
        const assigned_employee_ids = getAssignedEmployeeIds(job);

        const mappedJob = {
          hcp_job_id: job.id,
          job_number: job.invoice_number || '',
          customer_name: getCustomerName(job),
          job_type: getJobType(job),
          job_address: getJobAddress(job),
          status: job.work_status || null,
          scheduled_date,
          assigned_employee_ids,
          last_synced_at: new Date().toISOString(),
          raw_data: job,
        };

        // Debug logging
        if (!scheduled_date || !assigned_employee_ids?.length) {
          console.warn(`Job ${job.id} (${job.job_number}):`, {
            has_scheduled_date: !!scheduled_date,
            scheduled_date,
            assigned_employee_ids,
            raw_scheduled: job.schedule?.scheduled_start,
            raw_dispatched: job.dispatched_employees,
            work_status: job.work_status,
          });
        }

        await supabaseAdmin
          .from('hcp_jobs_cache')
          .upsert(mappedJob, { onConflict: 'hcp_job_id' });
      }

      console.log(`Synced ${jobs.length} jobs. Jobs with missing scheduled_date or employees logged above.`);

      return new Response(
        JSON.stringify({
          success: true,
          synced_count: jobs.length,
          last_synced_at: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('HCP sync error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
});
