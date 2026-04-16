'use server';

import { createServerFn } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const fetchCachedHcpJobs = createServerFn({ method: 'GET' }).handler(
  async (payload: { status?: string; employee_id?: string }) => {
    try {
      let query = supabaseAdmin.from('hcp_jobs_cache').select('*');

      if (payload.status) {
        query = query.eq('status', payload.status);
      }

      if (payload.employee_id) {
        query = query.contains('assigned_employee_ids', [payload.employee_id]);
      }

      const { data, error } = await query.order('scheduled_date', { ascending: true });

      if (error) {
        throw error;
      }

      return { success: true, jobs: data };
    } catch (error) {
      console.error('Fetch jobs error:', error);
      throw error;
    }
  }
);
