import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

const { data, error } = await supabase
  .from('hcp_jobs_cache')
  .select('job_number, customer_name, status, scheduled_date, assigned_employee_ids')
  .eq('scheduled_date', '2026-04-17')
  .order('job_number');

if (error) {
  console.error('❌ Error:', error.message);
} else {
  console.log(`✅ Jobs for tomorrow (2026-04-17): ${data.length} total`);
  data.forEach((job) => {
    console.log(`  #${job.job_number} - ${job.customer_name} (${job.status})`);
  });
}
