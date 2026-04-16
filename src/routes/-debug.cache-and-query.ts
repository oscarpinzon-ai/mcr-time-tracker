import { createAPIFileRoute } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createAPIFileRoute('/__debug/cache-and-query')({
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url);
      const employeeId = url.searchParams.get('employee_id');

      // Get today's date
      const today = new Date().toISOString().slice(0, 10);

      // Check what's in the cache for today
      const { data: cacheData, error: cacheError } = await supabaseAdmin
        .from('hcp_jobs_cache')
        .select('*')
        .eq('scheduled_date', today);

      if (cacheError) {
        throw cacheError;
      }

      console.log(`Cache for ${today}:`, cacheData?.length || 0, 'jobs');
      if (cacheData && cacheData.length > 0) {
        console.log('First cached job:', JSON.stringify(cacheData[0], null, 2));
      }

      // If employee_id is provided, check what the technician view would query
      let queryResult = null;
      if (employeeId) {
        const { data: jobs, error: queryError } = await supabaseAdmin
          .from('hcp_jobs_cache')
          .select('*')
          .eq('scheduled_date', today)
          .contains('assigned_employee_ids', [employeeId])
          .in('status', ['scheduled', 'in_progress']);

        if (queryError) {
          throw queryError;
        }

        console.log(`Query for employee ${employeeId}:`, jobs?.length || 0, 'jobs');
        queryResult = jobs;
      }

      return new Response(
        JSON.stringify({
          success: true,
          today,
          cacheStats: {
            total: cacheData?.length || 0,
            jobs: cacheData?.map((job: any) => ({
              id: job.id,
              hcp_job_id: job.hcp_job_id,
              job_number: job.job_number,
              status: job.status,
              scheduled_date: job.scheduled_date,
              assigned_employee_ids: job.assigned_employee_ids,
              last_synced_at: job.last_synced_at,
            })),
          },
          employeeQuery: employeeId
            ? {
                employee_id: employeeId,
                matched_jobs: queryResult?.length || 0,
                jobs: queryResult?.map((job: any) => ({
                  id: job.id,
                  hcp_job_id: job.hcp_job_id,
                  job_number: job.job_number,
                  status: job.status,
                  assigned_employee_ids: job.assigned_employee_ids,
                })),
              }
            : null,
          firstCacheJobRaw: cacheData && cacheData.length > 0 ? cacheData[0] : null,
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
