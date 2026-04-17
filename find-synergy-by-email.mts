import * as https from "https";

let found = false;

async function searchCustomers(query: string) {
  return new Promise<any>((resolve) => {
    https.request({
      hostname: "api.housecallpro.com",
      path: `/customers?q=${encodeURIComponent(query)}&page=1&page_size=10`,
      method: "GET",
      headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const response = JSON.parse(data);
        const customers = response.customers || response.data || [];
        
        customers.forEach((c: any) => {
          if (c.email === query || c.company_name?.includes("Synergy")) {
            console.log("✅ FOUND!");
            console.log(`  ID: ${c.id}`);
            console.log(`  Name: ${c.company_name || c.name}`);
            console.log(`  Email: ${c.email}`);
            console.log(`  Address: ${c.street}, ${c.city}, ${c.state} ${c.zip}`);
            found = true;
          }
        });
        resolve(response);
      });
    }).end();
  });
}

await searchCustomers("repairs@synergywastegroup.com");

if (!found) {
  console.log("❌ Not found with search. Let me fetch all and search...");
  
  // Fetch multiple pages and search
  for (let page = 1; page <= 5; page++) {
    const response = await new Promise<any>((resolve) => {
      https.request({
        hostname: "api.housecallpro.com",
        path: `/customers?page=${page}&page_size=100`,
        method: "GET",
        headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      }).end();
    });
    
    const customers = response.customers || response.data || [];
    const synergy = customers.find((c: any) => 
      c.email === "repairs@synergywastegroup.com" || 
      (c.company_name || "").includes("Synergy")
    );
    
    if (synergy) {
      console.log("✅ FOUND on page " + page);
      console.log(`  ID: ${synergy.id}`);
      console.log(`  Name: ${synergy.company_name || synergy.name}`);
      console.log(`  Email: ${synergy.email}`);
      console.log(`  Address: ${synergy.street}, ${synergy.city}, ${synergy.state} ${synergy.zip}`);
      process.exit(0);
    }
  }
}
