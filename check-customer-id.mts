import * as https from "https";

https.request({
  hostname: "api.housecallpro.com",
  path: "/jobs?page=1&page_size=5&scheduled_start_min=2026-04-16&scheduled_start_max=2026-04-17",
  method: "GET",
  headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const job = JSON.parse(data).jobs[0];
    console.log("Job #" + job.invoice_number);
    console.log("customer.id:", job.customer?.id);
    console.log("\nAll job ID-like fields:");
    console.log("  customer_id:", (job as any).customer_id);
    console.log("  customerId:", (job as any).customerId);
    console.log("  location_id:", (job as any).location_id);
    console.log("  locationId:", (job as any).locationId);
    console.log("  service_location_id:", (job as any).service_location_id);
    console.log("\nCustomer object ID:", job.customer?.id);
    console.log("\nALL job keys:", Object.keys(job).sort());
  });
}).end();
