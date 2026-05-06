import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PART_STATUSES, PRICING_STATUSES } from "@/lib/types";

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

const departmentSchema = z.enum(["dispatch", "parts", "other"]);

export const listWorkOrders = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getServerSupabase();
  const [{ data: workOrders }, { data: parts }] = await Promise.all([
    supabase.from("work_orders").select("*").order("updated_at", { ascending: false }),
    supabase.from("parts").select("id, work_order_id, status"),
  ]);
  return { workOrders: workOrders ?? [], parts: parts ?? [] };
});

export const getWorkOrderDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = getServerSupabase();
    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !workOrder) return { ok: false as const, error: error?.message ?? "Not found" };
    const { data: parts } = await supabase
      .from("parts")
      .select("*")
      .eq("work_order_id", data.id)
      .order("created_at", { ascending: true });
    const partIds = (parts ?? []).map((p) => p.id);
    let events: Database["public"]["Tables"]["part_events"]["Row"][] = [];
    if (partIds.length) {
      const { data: ev } = await supabase
        .from("part_events")
        .select("*")
        .in("part_id", partIds)
        .order("created_at", { ascending: true });
      events = ev ?? [];
    }
    return { ok: true as const, workOrder, parts: parts ?? [], events };
  });

const addPartSchema = z.object({
  workOrderId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  quantity: z.number().min(0).max(99999).optional(),
  requested_by: z.string().trim().max(120).optional().nullable(),
  department: departmentSchema,
});

export const addPart = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof addPartSchema>) => addPartSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getServerSupabase();
      const { data: row, error } = await supabase
        .from("parts")
        .insert({
          work_order_id: data.workOrderId,
          name: data.name,
          description: data.description ?? null,
          quantity: data.quantity ?? 1,
          requested_by: data.requested_by ?? null,
        })
        .select()
        .single();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, data: row };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Add failed" };
    }
  });

const updatePartSchema = z.object({
  id: z.string().uuid(),
  author: z.string().trim().max(120).optional().nullable(),
  department: departmentSchema,
  fields: z.object({
    name: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    part_number: z.string().trim().max(120).nullable().optional(),
    quantity: z.number().min(0).max(99999).optional(),
    vendor: z.string().trim().max(200).nullable().optional(),
    unit_price: z.number().min(0).max(1_000_000).nullable().optional(),
    total_price: z.number().min(0).max(10_000_000).nullable().optional(),
    pricing_status: z.enum(PRICING_STATUSES).optional(),
    tracking_number: z.string().trim().max(200).nullable().optional(),
    tracking_carrier: z.string().trim().max(120).nullable().optional(),
    eta: z.string().nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    requested_by: z.string().trim().max(120).nullable().optional(),
  }),
});

export const updatePart = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof updatePartSchema>) => updatePartSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getServerSupabase();
      const { error } = await supabase.from("parts").update(data.fields).eq("id", data.id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Update failed" };
    }
  });

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PART_STATUSES),
  message: z.string().trim().max(2000).optional().nullable(),
  author: z.string().trim().max(120).optional().nullable(),
  department: departmentSchema,
});

export const updatePartStatus = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof updateStatusSchema>) => updateStatusSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getServerSupabase();
      const patch: Database["public"]["Tables"]["parts"]["Update"] = { status: data.status };
      if (data.status === "ordered") patch.ordered_at = new Date().toISOString();
      if (data.status === "received") patch.received_at = new Date().toISOString();
      const { error } = await supabase.from("parts").update(patch).eq("id", data.id);
      if (error) return { ok: false as const, error: error.message };
      // Attach author/department to the status_change event by replacing the system one
      if (data.message || data.author) {
        await supabase.from("part_events").insert({
          part_id: data.id,
          event_type: "note",
          author: data.author ?? null,
          department: data.department,
          message: data.message ?? `Marked ${data.status}`,
        });
      }
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Status update failed" };
    }
  });

const noteSchema = z.object({
  partId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  author: z.string().trim().max(120).optional().nullable(),
  department: departmentSchema,
});

export const addPartNote = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof noteSchema>) => noteSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const supabase = getServerSupabase();
      const { error } = await supabase.from("part_events").insert({
        part_id: data.partId,
        event_type: "note",
        author: data.author ?? null,
        department: data.department,
        message: data.message,
      });
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Note failed" };
    }
  });

export const deletePart = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("parts").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteWorkOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("work_orders").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
