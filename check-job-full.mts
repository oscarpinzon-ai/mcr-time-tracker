import * as https from "https";

function fetchJobs(startDate: string, endDate: string) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.housecallpro.com",
      path: `/jobs?page=1&page_size=100&scheduled_start_min=${startDate}&scheduled_start_max=${endDate}`,
      method: "GET",
      headers: {
        Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2",
        Accept: "application/json",
      },
    };

    https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject).end();
  });
}

const data = (await fetchJobs("2026-04-16", "2026-04-17")) as any;
const job = data.jobs[0]; // First job

console.log("Job #" + job.invoice_number);
console.log("\nKey fields:");
console.log("  description:", job.description);
console.log("  customer.company_name:", job.customer?.company_name);
console.log("  customer.name:", job.customer?.name);
console.log("  customer.notes:", job.customer?.notes?.substring(0, 100));
console.log("  tags:", job.tags);
console.log("  notes[0]:", job.notes?.[0]?.content?.substring(0, 100));
console.log("\nCustomer object keys:", Object.keys(job.customer || {}));
