import { createAPIFileRoute } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const APIRoute = createAPIFileRoute("/api/update-job-type")({
  POST: async ({ request }) => {
    try {
      const { jobId, jobType } = (await request.json()) as { jobId: string; jobType: string };

      console.log(`[update-job-type] Updating job ${jobId} to type ${jobType}`);

      // Try service role first if available
      let error: any = null;
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const result = await supabaseAdmin
          .from("hcp_jobs_cache")
          .update({ job_type: jobType })
          .eq("id", jobId);
        error = result.error;
      } else {
        // Fallback: use public key (relies on RLS being open for this operation)
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          throw new Error("Missing Supabase environment variables");
        }
        const supabasePublic = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const result = await supabasePublic
          .from("hcp_jobs_cache")
          .update({ job_type: jobType })
          .eq("id", jobId);
        error = result.error;
      }

      if (error) {
        console.error(`[update-job-type] Error:`, error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      }

      console.log(`[update-job-type] Success`);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[update-job-type] Exception:`, msg);
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
  },
});
