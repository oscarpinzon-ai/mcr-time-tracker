import { createAPIFileRoute } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createAPIFileRoute('/__debug/technician')({
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url);
      const technicianName = url.searchParams.get('name') || 'Matthew Drennan';

      const today = new Date().toISOString().slice(0, 10);

      // Get the technician
      const { data: techs } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('name', technicianName);

      const technician = techs?.[0];

      if (!technician) {
        return new Response(
          JSON.stringify({
            error: `Technician "${technicianName}" not found`,
            available_technicians: (await supabaseAdmin
              .from('employees')
              .select('name, hcp_employee_id, role')
            ).data,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(`\n🔍 Debugging for: ${technician.name}`);
      console.log(`   DB ID: ${technician.id}`);
      console.log(`   HCP ID: ${technician.hcp_employee_id || 'NOT SET'}`);
      console.log(`   Role: ${technician.role}`);
      console.log(`   Today: ${today}\n`);

      // Check cache
      const { data: allCachedJobs } = await supabaseAdmin
        .from('hcp_jobs_cache')
        .select('*')
        .eq('scheduled_date', today);

      console.log(`Cache for today: ${allCachedJobs?.length || 0} total jobs`);

      // If technician has HCP ID, check what they'd see
      let matchedJobs = [];
      if (technician.hcp_employee_id) {
        const { data: techJobs } = await supabaseAdmin
          .from('hcp_jobs_cache')
          .select('*')
          .eq('scheduled_date', today)
          .contains('assigned_employee_ids', [technician.hcp_employee_id])
          .in('status', ['scheduled', 'in progress']);

        matchedJobs = techJobs || [];
        console.log(`Jobs assigned to ${technician.name}: ${matchedJobs.length}`);
      }

      return new Response(
        JSON.stringify({
          technician: {
            name: technician.name,
            id: technician.id,
            hcp_employee_id: technician.hcp_employee_id,
            role: technician.role,
          },
          today,
          cache_summary: {
            total_jobs_today: allCachedJobs?.length || 0,
            sample_jobs: allCachedJobs?.slice(0, 3).map(j => ({
              number: j.job_number,
              status: j.status,
              assigned_ids: j.assigned_employee_ids,
              customer: j.customer_name,
            })),
          },
          technician_query: {
            has_hcp_id: !!technician.hcp_employee_id,
            matched_jobs: matchedJobs.length,
            jobs: matchedJobs.map(j => ({
              number: j.job_number,
              status: j.status,
              customer: j.customer_name,
            })),
          },
          diagnosis: technician.hcp_employee_id
            ? matchedJobs.length === 0
              ? '⚠️ Technician has HCP ID but no matching jobs. Check if jobs are assigned in HCP.'
              : '✅ Jobs found!'
            : '❌ Technician has NO hcp_employee_id. Must sync from HCP first.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
});
