export type WorkOrder = {
  id: string;
  hcp_id: string | null;
  hcp_type: "job" | "estimate";
  number: string;
  customer_name: string | null;
  address: string | null;
  description: string | null;
  work_order_number: string | null;
  purchase_order_number: string | null;
  job_site_name: string | null;
  hcp_status: string | null;
  scheduled_date: string | null;
  assigned_to: string | null;
  raw_data: unknown;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PART_STATUSES = [
  "requested",
  "sent_to_parts",
  "pricing",
  "quoted",
  "approved",
  "ordered",
  "shipped",
  "received",
  "installed",
  "backordered",
  "cancelled",
] as const;
export type PartStatus = (typeof PART_STATUSES)[number];

export const PRICING_STATUSES = ["pending", "quoted", "confirmed"] as const;
export type PricingStatus = (typeof PRICING_STATUSES)[number];

export const DEPARTMENTS = ["dispatch", "parts", "other"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export type Part = {
  id: string;
  work_order_id: string;
  name: string;
  description: string | null;
  part_number: string | null;
  quantity: number;
  vendor: string | null;
  unit_price: number | null;
  total_price: number | null;
  pricing_status: PricingStatus;
  status: PartStatus;
  tracking_number: string | null;
  tracking_carrier: string | null;
  eta: string | null;
  requested_by: string | null;
  ordered_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PartEvent = {
  id: string;
  part_id: string;
  author: string | null;
  department: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  created_at: string;
};

export const STATUS_LABELS: Record<PartStatus, string> = {
  requested: "Requested",
  sent_to_parts: "Sent to Parts",
  pricing: "Getting Pricing",
  quoted: "Quoted",
  approved: "Approved",
  ordered: "Ordered",
  shipped: "Shipped",
  received: "Received",
  installed: "Installed",
  backordered: "Backordered",
  cancelled: "Cancelled",
};
