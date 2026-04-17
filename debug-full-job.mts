import * as https from "https";

function fetchJobs() {
  return new Promise((resolve, reject) => {
    https.request({
      hostname: "api.housecallpro.com",
      path: "/jobs?page=1&page_size=1&scheduled_start_min=2026-04-16&scheduled_start_max=2026-04-17",
      method: "GET",
      headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject).end();
  });
}

const data = (await fetchJobs()) as any;
const job = data.jobs[0];

// Print ALL string fields that might contain customer name
const maybeCustomer = {
  description: job.description,
  address_street: job.address?.street,
  address_city: job.address?.city,
  customer_company_name: job.customer?.company_name,
  customer_name: job.customer?.name,
  customer_email: job.customer?.email,
  customer_notes: job.customer?.notes?.substring(0, 150),
  tags: job.tags?.join(", "),
  work_line_items: job.work_line_items?.map((w: any) => w.name).join(", "),
  customFields: Object.keys(job).filter(k => !["id", "schedule", "work_timestamps", "assigned_employees", "notes", "address", "customer", "tags", "work_line_items", "job_fields", "permissions", "invoices"].includes(k) && typeof job[k] === 'string' && job[k])
};

console.log(JSON.stringify(maybeCustomer, null, 2));
console.log("\n✅ Check above for customer name (Synergy, Lowes, etc)");
