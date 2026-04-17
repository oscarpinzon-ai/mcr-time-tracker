import * as https from "https";

let foundSynergy = false;

async function fetchPage(page: number) {
  return new Promise((resolve) => {
    https.request({
      hostname: "api.housecallpro.com",
      path: `/customers?page=${page}&page_size=100`,
      method: "GET",
      headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const response = JSON.parse(data);
        const customers = response.customers || response.data || [];
        
        customers.forEach((c: any) => {
          const name = c.company_name || c.name || (c.first_name + " " + c.last_name);
          if (name.includes("Synergy") || name.includes("Lowes")) {
            console.log(`✅ Page ${page}: ${name}`);
            console.log(`   ID: ${c.id}`);
            console.log(`   Address: ${c.street || "N/A"}, ${c.city || "N/A"}, ${c.state || "N/A"}`);
            foundSynergy = true;
          }
        });
        resolve(null);
      });
    }).end();
  });
}

// Check first 3 pages
for (let i = 1; i <= 3; i++) {
  await fetchPage(i);
}

if (!foundSynergy) {
  console.log("❌ Synergy not found in first 300 customers");
  console.log("   The customer might be in the job's address field or another field");
}
