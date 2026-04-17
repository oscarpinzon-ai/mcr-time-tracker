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
    try {
      const supabase = getServerSupabase();

      // Get today's date in CDT, not UTC
      const getTodayInCDT = () => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === 'year')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        return `${year}-${month}-${day}`;
      };

      const getTodayDate = () => {
        const str = getTodayInCDT();
        return new Date(str + 'T00:00:00Z');
      };

      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const today = getTodayDate();
      const start = data.startDate ?? fmt(new Date(today.getTime() - 7 * 86400000));
      const end = data.endDate ?? fmt(new Date(today.getTime() + 7 * 86400000));

      const jobs = await fetchJobsInRange(start, end);
      const rows = jobs.map(mapHcpJob);

      let upserted = 0;
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

      return { ok: true, total: jobs.length, upserted, range: { start, end } };
    } catch (error) {
      console.error("HCP job sync failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Job sync failed",
      };
    }
  });

/** Auto clock-out at 7:00 PM CDT for active/paused time entries. */
export const autoClockOut = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; clockedOut: number } | HcpSyncErrorResult> => {
    try {
      const supabase = getServerSupabase();

      // Get 7 PM CDT time for today
      const get7pmCDT = () => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === 'year')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        const dateStr = `${year}-${month}-${day}T19:00:00Z`;
        return new Date(dateStr);
      };

      const clockOutTime = get7pmCDT().toISOString();

      // Find all active/paused entries with no clock_out
      const { data: entries, error: fetchErr } = await supabase
        .from("time_entries")
        .select("id, clock_in, total_minutes")
        .in("status", ["active", "paused"])
        .is("clock_out", null);

      if (fetchErr) throw new Error(`Fetch failed: ${fetchErr.message}`);

      let clockedOut = 0;

      for (const entry of entries ?? []) {
        // Close any open pause logs
        await supabase
          .from("pause_logs")
          .update({ pause_end: clockOutTime })
          .eq("time_entry_id", entry.id)
          .is("pause_end", null);

        // Calculate total minutes
        const clockInTime = new Date(entry.clock_in);
        const clockOutDate = new Date(clockOutTime);
        const totalMinutes = Math.floor((clockOutDate.getTime() - clockInTime.getTime()) / 60000);

        // Update time entry
        const { error: updateErr } = await supabase
          .from("time_entries")
          .update({
            clock_out: clockOutTime,
            status: "completed",
            total_minutes: totalMinutes,
          })
          .eq("id", entry.id);

        if (!updateErr) {
          // Log the edit
          await supabase.from("admin_edits_log").insert({
            time_entry_id: entry.id,
            edited_by: "System (Auto Clock-Out)",
            field_changed: "clock_out",
            old_value: null,
            new_value: clockOutTime,
          });
          clockedOut++;
        }
      }

      return { ok: true, clockedOut };
    } catch (error) {
      console.error("Auto clock-out failed", error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Auto clock-out failed",
      };
    }
  },
);
