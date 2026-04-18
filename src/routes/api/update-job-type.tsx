import { createAPIFileRoute } from "@tanstack/start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const APIRoute = createAPIFileRoute("/api/update-job-type")({
  POST: async ({ request }) => {
    const { jobId, jobType } = (await request.json()) as { jobId: string; jobType: string };

    const { error } = await supabaseAdmin
      .from("hcp_jobs_cache")
      .update({ job_type: jobType })
      .eq("id", jobId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  },
});
