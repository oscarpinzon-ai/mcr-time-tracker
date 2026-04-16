import { createAPIFileRoute } from '@tanstack/react-start/server';
import { fetchHcpJobs } from '@/lib/hcp-client';

export const Route = createAPIFileRoute('/__debug/hcp-jobs')({
  GET: async () => {
    const apiKey = process.env.HCP_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HCP_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Get today's date range
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

      console.log('Fetching HCP jobs for:', { todayStart, todayEnd });

      // Fetch jobs from HCP for today
      const jobs = await fetchHcpJobs(apiKey, {
        scheduled_start_min: todayStart,
        scheduled_start_max: todayEnd,
      });

      console.log(`Fetched ${jobs.length} jobs from HCP`);

      // Log the first job's structure in detail
      if (jobs.length > 0) {
        console.log('First job raw structure:', JSON.stringify(jobs[0], null, 2));
      }

      // Return detailed debug info
      return new Response(
        JSON.stringify({
          success: true,
          count: jobs.length,
          dateRange: { todayStart, todayEnd },
          jobs: jobs.map((job, idx) => ({
            index: idx,
            id: job.id,
            job_number: job.job_number,
            customer: {
              name: job.customer?.name,
              first_name: job.customer?.first_name,
              last_name: job.customer?.last_name,
            },
            work_status: job.work_status,
            schedule: {
              scheduled_start: job.schedule?.scheduled_start,
            },
            dispatched_employees: job.dispatched_employees ? job.dispatched_employees.map(e => ({ id: e.id })) : null,
            work_line_items: job.work_line_items ? job.work_line_items.map(l => ({ name: l.name })) : null,
            tags: job.tags,
            address: job.address,
          })),
          rawFirstJob: jobs.length > 0 ? jobs[0] : null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Debug endpoint error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
});
