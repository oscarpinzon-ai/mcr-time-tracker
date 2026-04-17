import * as https from "https";

async function searchPage(page: number) {
  return new Promise<any>((resolve) => {
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
        
        const synergy = customers.find((c: any) => 
          (c.company_name || "").includes("Synergy")
        );
        
        if (synergy) {
          console.log(`✅ FOUND on page ${page}`);
          console.log(`  ID: ${synergy.id}`);
          console.log(`  Name: ${synergy.company_name}`);
          console.log(`  Email: ${synergy.email}`);
          console.log(`  Company field: ${synergy.company}`);
          resolve(synergy);
        } else {
          resolve(null);
        }
      });
    }).end();
  });
}

// Search through pages
for (let i = 1; i <= 10; i++) {
  const result = await searchPage(i);
  if (result) {
    process.exit(0);
  }
}

console.log("❌ Not found in first 1000 customers");
