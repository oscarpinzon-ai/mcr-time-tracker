// HouseCall Pro API client for server-side use only
const HCP_BASE_URL = 'https://api.housecallpro.com/pro/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface HcpJobResponse {
  id: string;
  job_number: string;
  customer?: { name?: string; first_name?: string; last_name?: string };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  work_line_items?: Array<{ name: string }>;
  tags?: string[];
  work_status?: string;
  schedule?: { scheduled_start?: string };
  dispatched_employees?: Array<{ id: string }>;
  [key: string]: unknown;
}

interface HcpEmployeeResponse {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

interface HcpListResponse<T> {
  data: T[];
  pagination?: { page: number; per_page: number };
  [key: string]: unknown;
}

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw new Error(`HCP API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES && (lastError.message.includes('429') || lastError.message.includes('5'))) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (attempt === MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export async function fetchHcpJobs(
  apiKey: string,
  options?: {
    scheduled_start_min?: string;
    scheduled_start_max?: string;
    work_status?: string[];
  }
): Promise<HcpJobResponse[]> {
  const params = new URLSearchParams();
  if (options?.scheduled_start_min) params.append('scheduled_start_min', options.scheduled_start_min);
  if (options?.scheduled_start_max) params.append('scheduled_start_max', options.scheduled_start_max);
  if (options?.work_status?.length) {
    options.work_status.forEach(status => params.append('work_status[]', status));
  }

  const allJobs: HcpJobResponse[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const pageParams = new URLSearchParams(params);
    pageParams.append('page', page.toString());
    pageParams.append('per_page', perPage.toString());
    const pageUrl = `${HCP_BASE_URL}/jobs?${pageParams.toString()}`;

    const response = await fetchWithRetry(pageUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = (await response.json()) as HcpListResponse<HcpJobResponse>;
    allJobs.push(...data.data);

    if (!data.pagination || data.data.length < perPage) break;
    page++;
  }

  return allJobs;
}

export async function fetchHcpEmployees(apiKey: string): Promise<HcpEmployeeResponse[]> {
  const allEmployees: HcpEmployeeResponse[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    const url = `${HCP_BASE_URL}/employees?${params.toString()}`;

    const response = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = (await response.json()) as HcpListResponse<HcpEmployeeResponse>;
    allEmployees.push(...data.data);

    if (!data.pagination || data.data.length < perPage) break;
    page++;
  }

  return allEmployees;
}

export function getCustomerName(job: HcpJobResponse): string | null {
  if (job.customer?.name) return job.customer.name;
  if (job.customer?.first_name || job.customer?.last_name) {
    return `${job.customer.first_name || ''} ${job.customer.last_name || ''}`.trim();
  }
  return null;
}

export function getJobAddress(job: HcpJobResponse): string | null {
  const addr = job.address;
  if (!addr) return null;
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function getJobType(job: HcpJobResponse): string | null {
  if (job.work_line_items?.[0]?.name) {
    return job.work_line_items[0].name;
  }
  if (job.tags?.[0]) {
    return job.tags[0];
  }
  return null;
}

export function getScheduledDate(job: HcpJobResponse): string | null {
  const scheduled = job.schedule?.scheduled_start;
  if (!scheduled) return null;
  return new Date(scheduled).toISOString().split('T')[0];
}

export function getAssignedEmployeeIds(job: HcpJobResponse): string[] {
  return job.dispatched_employees?.map(emp => emp.id) || [];
}

export function getEmployeeName(emp: HcpEmployeeResponse): string {
  if (emp.name) return emp.name;
  return `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || `Employee ${emp.id}`;
}
