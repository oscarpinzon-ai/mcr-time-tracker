import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchAllEmployees,
  performHcpJobSync,
  performAutoClockOut,
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

type HcpSyncErrorResult = {
  ok: false;
  error: string;
};

type HcpEmployeeSyncResult =
  | {
      ok: true;
      total: number;
      created: number;
      updated: number;
    }
  | HcpSyncErrorResult;

type HcpJobSyncResult =
  | {
      ok: true;
      total: number;
      upserted: number;
      range: { start: string; end: string };
    }
  | HcpSyncErrorResult;

/** Sync employees from HouseCall Pro into the employees table. */
export const syncHcpEmployees = createServerFn({ method: "POST" }).handler(
  async (): Promise<HcpEmployeeSyncResult> => {
    try {
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

      return { ok: true, total: hcpEmployees.length, created, updated };
    } catch (error) {
      console.error("HCP employee sync failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Employee sync failed",
      };
    }
  },
);

/** Sync jobs from HouseCall Pro into hcp_jobs_cache for a date range. */
export const syncHcpJobs = createServerFn({ method: "POST" })
  .inputValidator((input: { startDate?: string; endDate?: string }) => input)
  .handler(async ({ data }): Promise<HcpJobSyncResult> => {
    return performHcpJobSync(data);
  });

/** Auto clock-out at 7:00 PM CDT for active/paused time entries. */
export const autoClockOut = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; clockedOut: number } | HcpSyncErrorResult> => {
    return performAutoClockOut();
  },
);
