import * as https from "https";

function fetchJobs() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.housecallpro.com",
      path: "/jobs?page=1&page_size=100&scheduled_start_min=2026-04-17&scheduled_start_max=2026-04-17",
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

const data = (await fetchJobs()) as any;
console.log("Total jobs for 2026-04-17:", data.jobs.length);
data.jobs.slice(0, 3).forEach((job: any) => {
  console.log(`\n📋 Job #${job.invoice_number}`);
  console.log(`   Description: ${job.description || "(empty)"}`);
  console.log(`   Customer Company: ${job.customer?.company_name || "(empty)"}`);
  console.log(`   Customer Name: ${job.customer?.name || "(empty)"}`);
  if (job.notes && job.notes.length > 0) {
    console.log(`   First Note: ${job.notes[0].content.split("\n")[0]}`);
  }
  if (job.tags && job.tags.length > 0) {
    console.log(`   Tags: ${job.tags.join(", ")}`);
  }
});
