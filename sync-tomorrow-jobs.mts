import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const HCP_API_KEY = process.env.HCP_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !HCP_API_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper functions for mapping
function getScheduledDate(job: any): string | null {
  const scheduled = job.schedule?.scheduled_start;
  if (!scheduled) return null;
  const date = new Date(scheduled);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

function getAssignedEmployeeIds(job: any): string[] {
  return job.assigned_employees?.map((emp: any) => emp.id).filter(Boolean) || [];
}

function getCustomerName(job: any): string | null {
  if (job.customer?.company_name) return job.customer.company_name;
  if (job.customer?.first_name || job.customer?.last_name) {
    return `${job.customer.first_name || ''} ${job.customer.last_name || ''}`.trim();
  }
  return null;
}

function getJobAddress(job: any): string | null {
  const addr = job.address;
  if (!addr) return null;
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

async function main() {
  try {
    // Get tomorrow's date in CDT
    const tomorrow = new Date(new Date().getTime() + 86400000);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(tomorrow);
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2024';
    const tomorrowStart = `${year}-${month}-${day}T00:00:00Z`;
    const tomorrowEnd = `${year}-${month}-${day}T23:59:59Z`;

    console.log(`🔍 Syncing jobs for TOMORROW: ${year}-${month}-${day}`);

    // Fetch from HCP
    const params = new URLSearchParams({
      scheduled_start_min: tomorrowStart,
      scheduled_start_max: tomorrowEnd,
    });

    const response = await fetch(`https://api.housecallpro.com/jobs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${HCP_API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(`HCP API error: ${response.status}`);
    }

    const hcpData = await response.json();
    const jobs = hcpData.jobs || [];

    console.log(`✅ Found ${jobs.length} jobs from HCP for tomorrow\n`);

    // Map and upsert to database
    let synced = 0;
    for (const job of jobs) {
      const scheduled_date = getScheduledDate(job);
      const assigned_employee_ids = getAssignedEmployeeIds(job);

      if (!scheduled_date) {
        console.warn(`⚠️  Skipping job ${job.id}: missing scheduled_date`);
        continue;
      }

      // Only sync jobs with employees assigned
      if (!assigned_employee_ids.length) {
        console.warn(`⚠️  Skipping job ${job.id}: no assigned employees`);
        continue;
      }

      // Only sync scheduled and in progress jobs
      const status = job.work_status || '';
      if (!['scheduled', 'in progress'].includes(status)) {
        console.log(`⏭️  Skipping job ${job.id} (status: ${status})`);
        continue;
      }

      const mappedJob = {
        hcp_job_id: job.id,
        job_number: job.invoice_number || '',
        customer_name: getCustomerName(job),
        job_type: job.work_line_items?.[0]?.name || null,
        job_address: getJobAddress(job),
        status,
        scheduled_date,
        assigned_employee_ids,
        last_synced_at: new Date().toISOString(),
        raw_data: job,
      };

      const { error } = await supabase
        .from('hcp_jobs_cache')
        .upsert(mappedJob, { onConflict: 'hcp_job_id' });

      if (error) {
        console.error(`❌ Error upserting job ${job.id}:`, error.message);
      } else {
        synced++;
        console.log(`✅ Synced: #${mappedJob.job_number} → ${assigned_employee_ids.join(', ')}`);
      }
    }

    console.log(`\n🎉 Successfully synced ${synced} jobs to database for tomorrow`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
