'use server';

import { createServerFn } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  fetchHcpJobs,
  getCustomerName,
  getJobAddress,
  getJobType,
  getScheduledDate,
  getAssignedEmployeeIds,
} from '@/lib/hcp-client';

export const syncHcpJobs = createServerFn({ method: 'POST' }).handler(async () => {
  const apiKey = process.env.HCP_API_KEY;
  if (!apiKey) {
    throw new Error('HCP_API_KEY not configured');
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

    return {
      success: true,
      synced_count: jobs.length,
      last_synced_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('HCP sync error:', error);
    throw error;
  }
});
