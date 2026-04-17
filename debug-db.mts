import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Checking database state...\n');

  // Get all employees
  const { data: employees } = await supabase.from('employees').select('*');
  console.log('👥 Employees:');
  employees?.forEach(emp => {
    console.log(`  - ${emp.name} (ID: ${emp.id.substring(0, 8)}..., HCP ID: ${emp.hcp_employee_id || 'NONE'})`);
  });

  // Get today's jobs in cache
  const today = new Date().toISOString().slice(0, 10);
  const { data: jobs } = await supabase
    .from('hcp_jobs_cache')
    .select('*')
    .eq('scheduled_date', today);

  console.log(`\n📋 Jobs cached for today (${today}):`);
  console.log(`   Total: ${jobs?.length || 0}`);

  if (jobs && jobs.length > 0) {
    jobs.forEach((job, idx) => {
      console.log(`\n   [Job ${idx + 1}]`);
      console.log(`     #${job.job_number} - ${job.customer_name}`);
      console.log(`     Status: ${job.status}`);
      console.log(`     Assigned IDs: ${JSON.stringify(job.assigned_employee_ids)}`);
    });
  }

  // For each employee with hcp_employee_id, check what jobs they would see
  console.log('\n\n🔎 Jobs per technician (for today):');
  for (const emp of employees || []) {
    if (!emp.hcp_employee_id) {
      console.log(`\n   ❌ ${emp.name}: No HCP ID assigned`);
      continue;
    }

    const { data: empJobs } = await supabase
      .from('hcp_jobs_cache')
      .select('*')
      .eq('scheduled_date', today)
      .contains('assigned_employee_ids', [emp.hcp_employee_id])
      .in('status', ['scheduled', 'in progress']);

    console.log(`\n   ✅ ${emp.name} (HCP: ${emp.hcp_employee_id}):`);
    console.log(`      Would see ${empJobs?.length || 0} jobs`);
    if (empJobs && empJobs.length > 0) {
      empJobs.forEach(job => {
        console.log(`      - #${job.job_number}: ${job.status}`);
      });
    }
  }
}

main().catch(console.error);
