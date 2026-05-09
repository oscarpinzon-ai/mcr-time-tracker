// Parses the first work line item from HCP invoices.
// Example: "WO: 344687392 PO # 105270-01 - 12601 TECH RIDGE BLVD - Walgreen Drug Store # 09679"
export interface ServiceReferenceFields {
  work_order_number: string | null;
  purchase_order_number: string | null;
  job_site_name: string | null;
}

export function parseServiceReference(raw: string | null | undefined): ServiceReferenceFields {
  if (!raw?.trim()) {
    return { work_order_number: null, purchase_order_number: null, job_site_name: null };
  }

  // WO: matches "WO: 344687392", "WO # 344687392", "WO#344687392"
  const woMatch = raw.match(/\bWO[\s:#]*(\w[\w-]*)/i);
  // PO: matches "PO # 105270-01", "PO: 105270-01", "PO#105270-01"
  const poMatch = raw.match(/\bPO[\s:#]*(\w[\w-]*)/i);

  // Job site name is the last segment after " - "
  // e.g. [..., "12601 TECH RIDGE BLVD", "Walgreen Drug Store # 09679"] → last one
  const segments = raw.split(/ - /);
  const jobSiteName = segments.length > 1 ? segments[segments.length - 1].trim() : null;

  return {
    work_order_number: woMatch?.[1] ?? null,
    purchase_order_number: poMatch?.[1] ?? null,
    job_site_name: jobSiteName,
  };
}
