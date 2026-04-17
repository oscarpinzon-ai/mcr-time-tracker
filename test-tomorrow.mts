import * as fs from 'fs';
import * as path from 'path';

const devVarsPath = path.join(process.cwd(), '.dev.vars');
let envVars: Record<string, string> = {};

if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf-8');
  content.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    }
  });
}

const HCP_API_KEY = envVars.HCP_API_KEY || process.env.HCP_API_KEY;

if (!HCP_API_KEY) {
  console.error('❌ HCP_API_KEY not found');
  process.exit(1);
}

const HCP_BASE_URL = 'https://api.housecallpro.com';

async function main() {
  // Get tomorrow's date in CDT
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

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

  console.log(`🔍 Fetching jobs for TOMORROW from HouseCall Pro...\n`);
  console.log(`📅 Date Range: ${tomorrowStart} to ${tomorrowEnd}\n`);

  const params = new URLSearchParams({
    scheduled_start_min: tomorrowStart,
    scheduled_start_max: tomorrowEnd,
  });

  const response = await fetch(`${HCP_BASE_URL}/jobs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${HCP_API_KEY}` },
  });

  if (!response.ok) {
    console.error(`❌ HCP API Error: ${response.status}`);
    process.exit(1);
  }

  const data = await response.json() as any;
  const jobs = data.jobs || [];

  console.log(`✅ Found ${jobs.length} jobs for tomorrow\n`);

  if (jobs.length === 0) {
    console.log('No jobs scheduled for tomorrow.');
    process.exit(0);
  }

  // Show all jobs with their assigned employees
  jobs.forEach((job: any, idx: number) => {
    const assigned = job.assigned_employees?.map((e: any) => `${e.first_name} ${e.last_name}`.trim()).join(', ') || 'None';
    console.log(`[${idx + 1}] #${job.invoice_number} - ${job.customer?.company_name || 'N/A'}`);
    console.log(`    Status: ${job.work_status}`);
    console.log(`    Assigned: ${assigned}`);
    console.log();
  });
}

main().catch(console.error);
