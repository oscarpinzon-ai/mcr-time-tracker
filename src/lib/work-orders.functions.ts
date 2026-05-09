import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchHcpJobByNumber,
  fetchHcpEstimateByNumber,
  getCustomerName,
  getJobAddress,
  getScheduledDate,
  getEstimateAddress,
  getEstimateCustomer,
  type HcpEstimateResponse,
} from "@/lib/hcp-client";
import { parseServiceReference } from "@/lib/service-reference";

function getServerSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing on server");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getApiKey() {
  const k = process.env.HCP_API_KEY;
  if (!k) throw new Error("HCP_API_KEY is not configured");
  return k;
}

type Normalized = {
  hcp_id: string;
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
};

async function lookup(type: "job" | "estimate", number: string): Promise<Normalized | null> {
  const apiKey = getApiKey();
  if (type === "job") {
    const job = await fetchHcpJobByNumber(apiKey, number);
    if (!job) return null;
    const assigned =
      job.assigned_employees
        ?.map((e) => `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim())
        .filter(Boolean)
        .join(", ") || null;
    const serviceRef = job.work_line_items?.[0]?.name ?? job.description ?? null;
    const parsed = parseServiceReference(serviceRef);
    return {
      hcp_id: job.id,
      hcp_type: "job",
      number:
        String(
          (job as { invoice_number?: string }).invoice_number ??
            (job as { job_number?: string }).job_number ??
            number,
        ).replace(/^#/, ""),
      customer_name: getCustomerName(job),
      address: getJobAddress(job),
      description: serviceRef,
      work_order_number: parsed.work_order_number,
      purchase_order_number: parsed.purchase_order_number,
      job_site_name: parsed.job_site_name,
      hcp_status: job.work_status ?? null,
      scheduled_date: getScheduledDate(job),
      assigned_to: assigned,
      raw_data: job,
    };
  }
  const est: HcpEstimateResponse | null = await fetchHcpEstimateByNumber(apiKey, number);
  if (!est) return null;
  const assigned =
    est.assigned_employees
      ?.map((e) => `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim())
      .filter(Boolean)
      .join(", ") || null;
  return {
    hcp_id: est.id,
    hcp_type: "estimate",
    number: String(est.estimate_number ?? est.number ?? number).replace(/^#/, ""),
    customer_name: getEstimateCustomer(est),
    address: getEstimateAddress(est),
    description: est.message ?? null,
    hcp_status: est.work_status ?? est.status ?? null,
    scheduled_date: est.schedule?.scheduled_start
      ? new Date(est.schedule.scheduled_start).toISOString().slice(0, 10)
      : null,
    assigned_to: assigned,
    raw_data: est,
  };
}

const lookupSchema = z.object({
  type: z.enum(["job", "estimate"]),
  number: z.string().trim().min(1).max(50),
});

export const lookupHcpWorkOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { type: "job" | "estimate"; number: string }) => lookupSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const result = await lookup(data.type, data.number);
      if (!result) return { ok: false as const, error: `${data.type === "job" ? "Job" : "Estimate"} #${data.number} not found in HouseCall Pro.` };
      const { raw_data: _omit, ...preview } = result;
      void _omit;
      return { ok: true as const, data: preview };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Lookup failed" };
    }
  });

export const importWorkOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { type: "job" | "estimate"; number: string }) => lookupSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const normalized = await lookup(data.type, data.number);
      if (!normalized)
        return { ok: false as const, error: `${data.type === "job" ? "Job" : "Estimate"} #${data.number} not found.` };
      const supabase = getServerSupabase();
      const { data: row, error } = await supabase
        .from("work_orders")
        .upsert(
          {
            ...normalized,
            raw_data: normalized.raw_data as never,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "hcp_type,number" },
        )
        .select()
        .single();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, data: row };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Import failed" };
    }
  });

export const refreshWorkOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getServerSupabase();
      const { data: row, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("id", data.id)
        .single();
      if (error || !row) return { ok: false as const, error: error?.message ?? "Not found" };
      const normalized = await lookup(row.hcp_type as "job" | "estimate", row.number);
      if (!normalized) return { ok: false as const, error: "No longer found in HCP" };
      const { error: upErr } = await supabase
        .from("work_orders")
        .update({
          customer_name: normalized.customer_name,
          address: normalized.address,
          description: normalized.description,
          work_order_number: normalized.work_order_number,
          purchase_order_number: normalized.purchase_order_number,
          job_site_name: normalized.job_site_name,
          hcp_status: normalized.hcp_status,
          scheduled_date: normalized.scheduled_date,
          assigned_to: normalized.assigned_to,
          raw_data: normalized.raw_data as never,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (upErr) return { ok: false as const, error: upErr.message };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Refresh failed" };
    }
  });

const manualSchema = z.object({
  type: z.enum(["job", "estimate"]),
  number: z.string().trim().min(1).max(50),
  customer_name: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const createManualWorkOrder = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof manualSchema>) => manualSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getServerSupabase();
      const { data: row, error } = await supabase
        .from("work_orders")
        .upsert(
          {
            hcp_type: data.type,
            number: data.number.replace(/^#/, ""),
            customer_name: data.customer_name ?? null,
            address: data.address ?? null,
            description: data.description ?? null,
          },
          { onConflict: "hcp_type,number" },
        )
        .select()
        .single();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, data: row };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Create failed" };
    }
  });
