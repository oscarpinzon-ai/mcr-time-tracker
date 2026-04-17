import * as https from "https";

https.request({
  hostname: "api.housecallpro.com",
  path: "/jobs?page=1&page_size=100&scheduled_start_min=2026-04-17&scheduled_start_max=2026-04-17",
  method: "GET",
  headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const jobs = JSON.parse(data).jobs;
    
    // Find any job with Synergy, Lowes, or the right invoice number
    jobs.forEach((job: any) => {
      const jobStr = JSON.stringify(job);
      if (jobStr.includes("Synergy") || jobStr.includes("Lowes") || jobStr.includes("1495 US Hwy")) {
        console.log("\n✅ FOUND IT!");
        console.log("Invoice:", job.invoice_number);
        console.log("\nAll top-level keys:", Object.keys(job).filter(k => typeof job[k] !== 'object'));
        
        // Search for Synergy in the job
        for (const [key, value] of Object.entries(job)) {
          const str = JSON.stringify(value);
          if (str.includes("Synergy") || str.includes("Lowes") || str.includes("1495")) {
            console.log(`\n📍 Found in: job.${key}`);
            console.log(JSON.stringify(value, null, 2).substring(0, 300));
          }
        }
      }
    });
  });
}).end();
