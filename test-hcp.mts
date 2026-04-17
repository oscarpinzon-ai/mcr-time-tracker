import * as fs from 'fs';
import * as path from 'path';

// Load .dev.vars
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
  console.error('❌ HCP_API_KEY not found in .dev.vars or environment');
  console.error('   Please add HCP_API_KEY to .dev.vars or set it as an environment variable');
  process.exit(1);
}

console.log('🔍 Fetching today\'s jobs from HouseCall Pro API...\n');

const HCP_BASE_URL = 'https://api.housecallpro.com';

interface HcpResponse {
  jobs?: any[];
  page?: number;
  page_size?: number;
  total_pages?: number;
  total_items?: number;
  [key: string]: unknown;
}

async function fetchHcpJobs(apiKey: string) {
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

  console.log(`📅 Date Range: ${todayStart} to ${todayEnd}\n`);

  const params = new URLSearchParams({
    scheduled_start_min: todayStart,
    scheduled_start_max: todayEnd,
  });

  const url = `${HCP_BASE_URL}/jobs?${params.toString()}`;
  console.log(`🌐 Calling: ${url}\n`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    console.error(`❌ HCP API Error: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error('Response:', text);
    process.exit(1);
  }

  const data = (await response.json()) as HcpResponse;
  return data;
}

async function main() {
  try {
    const response = await fetchHcpJobs(HCP_API_KEY);

    const jobCount = Array.isArray(response.jobs) ? response.jobs.length : 0;
    console.log(`✅ Success! Found ${jobCount} jobs\n`);

    if (jobCount === 0) {
      console.log('⚠️  No jobs returned for today');
      console.log('\nFull Response:');
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log('📊 First Job Full Structure:');
      console.log(JSON.stringify(response.jobs![0], null, 2));

      if (jobCount > 1) {
        console.log(`\n\n⚙️  Summary of all ${jobCount} jobs:`);
        response.jobs!.forEach((job: any, idx: number) => {
          console.log(`\n[Job ${idx + 1}]`);
          console.log(`  ID: ${job.id}`);
          console.log(`  Job #: ${job.invoice_number}`);
          console.log(`  Status: ${job.work_status}`);
          console.log(`  Scheduled: ${job.schedule?.scheduled_start}`);
          console.log(`  Assigned Employees: ${
            job.assigned_employees
              ? job.assigned_employees.map((e: any) => `${e.first_name} ${e.last_name}`).join(', ')
              : 'NONE'
          }`);
          console.log(`  Customer: ${job.customer?.company_name || job.description}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
