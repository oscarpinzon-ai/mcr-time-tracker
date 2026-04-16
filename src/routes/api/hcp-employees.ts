'use server';

import { createServerFn } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { fetchHcpEmployees, getEmployeeName } from '@/lib/hcp-client';

export const syncHcpEmployees = createServerFn({ method: 'POST' }).handler(async () => {
  const apiKey = process.env.HCP_API_KEY;
  if (!apiKey) {
    throw new Error('HCP_API_KEY not configured');
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

    return {
      success: true,
      new_count: newCount,
      updated_count: updatedCount,
      total_synced: hcpEmployees.length,
    };
  } catch (error) {
    console.error('Employee sync error:', error);
    throw error;
  }
});
