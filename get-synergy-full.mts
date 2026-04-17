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
    console.log(JSON.stringify(customer, null, 2));
  });
}).end();
