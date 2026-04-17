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
console.log("Total jobs:", data.jobs.length);

// Find job 17157
const job17157 = data.jobs.find((j: any) => j.invoice_number === "17157");
if (job17157) {
  console.log("\n✅ Found Job #17157:");
  console.log("  Description:", job17157.description || "(empty)");
  console.log("  Customer Company:", job17157.customer?.company_name);
  console.log("  Customer Name:", job17157.customer?.name);
  console.log("  Customer Email:", job17157.customer?.email);
  if (job17157.notes?.[0]) {
    console.log("  First Note:", job17157.notes[0].content.split("\n")[0]);
  }
  console.log("  Tags:", job17157.tags || []);
  console.log("\n  Assigned to:", job17157.assigned_employees?.[0]?.first_name, job17157.assigned_employees?.[0]?.last_name);
} else {
  console.log("\n❌ Job #17157 not found");
  console.log("\nAvailable jobs:");
  data.jobs.forEach((j: any) => {
    console.log(`  - #${j.invoice_number} (${j.customer?.company_name || "N/A"})`);
  });
}
