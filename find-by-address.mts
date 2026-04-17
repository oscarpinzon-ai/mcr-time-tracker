import * as https from "https";

https.request({
  hostname: "api.housecallpro.com",
  path: "/customers/cus_754b15c4bebf4862b1779fbb2feb705e",
  method: "GET",
  headers: { Authorization: "Bearer 6225c530ca6e4496b08ebee1e40cf3b2" },
}, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const customer = JSON.parse(data);
    
    console.log("Customer ID: " + customer.id);
    console.log("Customer Name: " + customer.company_name);
    console.log("\nAddresses:");
    
    customer.addresses?.forEach((addr: any, i: number) => {
      const fullAddr = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
      console.log(`\n  [${i}] ${addr.type.toUpperCase()}`);
      console.log(`      ${fullAddr}`);
      console.log(`      ID: ${addr.id}`);
      
      if (fullAddr.includes("1495 US Hwy 183") || fullAddr.includes("Leander")) {
        console.log("      ⭐ THIS IS THE ONE!");
      }
    });
  });
}).end();
