import { createAPIFileRoute } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { fetchHcpEmployees, getEmployeeName } from '@/lib/hcp-client';

export const Route = createAPIFileRoute('/__internal/sync-hcp-employees')({
  POST: async () => {
    const apiKey = process.env.HCP_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HCP_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const hcpEmployees = await fetchHcpEmployees(apiKey);

      let newCount = 0;
      let updatedCount = 0;

      for (const emp of hcpEmployees) {
        const { data: existing } = await supabaseAdmin
          .from('employees')
          .select('id')
          .eq('hcp_employee_id', emp.id)
          .single();

        if (existing) {
          const { error } = await supabaseAdmin
            .from('employees')
            .update({ name: getEmployeeName(emp) })
            .eq('hcp_employee_id', emp.id);
          if (!error) updatedCount++;
        } else {
          const { error } = await supabaseAdmin.from('employees').insert({
            name: getEmployeeName(emp),
            hcp_employee_id: emp.id,
            is_active: true,
            role: 'technician',
          });
          if (!error) newCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          new_count: newCount,
          updated_count: updatedCount,
          total_synced: hcpEmployees.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Employee sync error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
});
