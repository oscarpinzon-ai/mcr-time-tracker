import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchAllEmployees,
  fetchJobsInRange,
  mapHcpJob,
} from "@/lib/hcp.server";

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

/** Sync employees from HouseCall Pro into the employees table. */
export const syncHcpEmployees = createServerFn({ method: "POST" }).handler(
  async () => {
    const supabase = getServerSupabase();
    const hcpEmployees = await fetchAllEmployees();

    const { data: existing, error: fetchErr } = await supabase
      .from("employees")
      .select("id, name, hcp_employee_id");
    if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`);

    const byHcpId = new Map(
      (existing ?? [])
        .filter((e) => e.hcp_employee_id)
        .map((e) => [e.hcp_employee_id as string, e]),
    );

    let created = 0;
    let updated = 0;

    for (const emp of hcpEmployees) {
      const fullName =
        emp.name ??
        [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim();
      if (!fullName) continue;

      const existingRow = byHcpId.get(emp.id);
      if (existingRow) {
        if (existingRow.name !== fullName) {
          const { error } = await supabase
            .from("employees")
            .update({ name: fullName })
            .eq("id", existingRow.id);
          if (!error) updated++;
        }
      } else {
        const { error } = await supabase.from("employees").insert({
          name: fullName,
          hcp_employee_id: emp.id,
          role: "technician",
          is_active: true,
        });
        if (!error) created++;
      }
    }

    return { total: hcpEmployees.length, created, updated };
  },
);

/** Sync jobs from HouseCall Pro into hcp_jobs_cache for a date range. */
export const syncHcpJobs = createServerFn({ method: "POST" })
  .inputValidator((input: { startDate?: string; endDate?: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabase();
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const start = data.startDate ?? fmt(new Date(today.getTime() - 7 * 86400000));
    const end = data.endDate ?? fmt(new Date(today.getTime() + 7 * 86400000));

    const jobs = await fetchJobsInRange(start, end);
    const rows = jobs.map(mapHcpJob);

    let upserted = 0;
    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50).map((r) => ({
        ...r,
        raw_data: JSON.parse(JSON.stringify(r.raw_data)),
      }));
      const { error } = await supabase
        .from("hcp_jobs_cache")
        .upsert(batch, { onConflict: "hcp_job_id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
      upserted += batch.length;
    }

    return { total: jobs.length, upserted, range: { start, end } };
  });
