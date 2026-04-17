import * as https from "https";

https.request({
  hostname: "api.housecallpro.com",
  path: "/jobs?page=1&page_size=1&scheduled_start_min=2026-04-16&scheduled_start_max=2026-04-17",
  method: "GET",
  headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const job = JSON.parse(data).jobs[0];
    console.log(JSON.stringify(job, null, 2));
  });
}).end();
