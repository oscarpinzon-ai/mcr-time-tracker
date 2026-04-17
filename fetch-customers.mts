import * as https from "https";

https.request({
  hostname: "api.housecallpro.com",
  path: "/customers?page=1&page_size=20",
  method: "GET",
  headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const response = JSON.parse(data);
    console.log("Total customers:", response.total_items || response.customers?.length || "?");
    
    if (response.customers || response.data) {
      const customers = response.customers || response.data;
      console.log("\nFirst 5 customers:");
      customers.slice(0, 5).forEach((c: any) => {
        console.log(`\n  ID: ${c.id}`);
        console.log(`  Name: ${c.company_name || c.name || (c.first_name + " " + c.last_name)}`);
      });
      
      // Search for Synergy
      const synergy = customers.find((c: any) => 
        (c.company_name || c.name || "").includes("Synergy")
      );
      if (synergy) {
        console.log("\n✅ FOUND Synergy!");
        console.log(JSON.stringify(synergy, null, 2).substring(0, 500));
      }
    }
  });
}).end();
