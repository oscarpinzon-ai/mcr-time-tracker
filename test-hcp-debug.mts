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

console.log(`✅ API Key loaded: ${HCP_API_KEY.substring(0, 8)}...`);
console.log(`\nTesting different endpoint variations:\n`);

const endpoints = [
  'https://api.housecallpro.com/v1/jobs',
  'https://api.housecallpro.com/pro/v1/jobs',
  'https://api.housecallpro.com/api/v1/jobs',
  'https://housecallpro.com/api/v1/jobs',
];

async function testEndpoint(url: string) {
  console.log(`Testing: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${HCP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`  Status: ${response.status}`);
    const contentType = response.headers.get('content-type');
    console.log(`  Content-Type: ${contentType}`);

    if (response.status === 200 || response.status === 400 || response.status === 401) {
      const text = await response.text();
      if (text.includes('<!DOCTYPE')) {
        console.log(`  Response: HTML page (unexpected)\n`);
      } else {
        try {
          const json = JSON.parse(text);
          console.log(`  Response: ${JSON.stringify(json).substring(0, 200)}...\n`);
        } catch {
          console.log(`  Response: ${text.substring(0, 200)}...\n`);
        }
      }
    } else {
      console.log(`  Response: ${response.status} error\n`);
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : error}\n`);
  }
}

async function main() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

main();
