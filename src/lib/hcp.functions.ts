import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchAllEmployees,
  fetchJobsInRange,
  mapHcpJob,
} from "@/lib/hcp.server";

/** Sync employees from HouseCall Pro into the employees table. */
export const syncHcpEmployees = createServerFn({ method: "POST" }).handler(
  async () => {
    const hcpEmployees = await fetchAllEmployees();

    const { data: existing, error: fetchErr } = await supabaseAdmin
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

      const existing = byHcpId.get(emp.id);
      if (existing) {
        if (existing.name !== fullName) {
          const { error } = await supabaseAdmin
            .from("employees")
            .update({ name: fullName })
            .eq("id", existing.id);
          if (!error) updated++;
        }
      } else {
        const { error } = await supabaseAdmin.from("employees").insert({
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
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const start = data.startDate ?? fmt(new Date(today.getTime() - 7 * 86400000));
    const end = data.endDate ?? fmt(new Date(today.getTime() + 7 * 86400000));

    const jobs = await fetchJobsInRange(start, end);
    const rows = jobs.map(mapHcpJob);

    let upserted = 0;
    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabaseAdmin
        .from("hcp_jobs_cache")
        .upsert(batch, { onConflict: "hcp_job_id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
      upserted += batch.length;
    }

    return { total: jobs.length, upserted, range: { start, end } };
  });
