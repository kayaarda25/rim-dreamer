import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update project status to processing
    const { error: updateError } = await supabase
      .from("reconstruction_projects")
      .update({
        status: "processing",
        progress_stage: "preparing_images",
        updated_at: new Date().toISOString(),
      })
      .eq("id", project_id);

    if (updateError) throw new Error(updateError.message);

    // Get project files
    const { data: files, error: filesError } = await supabase
      .from("reconstruction_files")
      .select("*")
      .eq("project_id", project_id);

    if (filesError) throw new Error(filesError.message);

    console.log(`Project ${project_id}: ${files?.length || 0} files, enqueuing for reconstruction`);

    // In a real setup, this would push to a Redis/BullMQ queue or call a GPU worker API.
    // For now, we log the job details. The external worker should poll this table
    // or receive a webhook/queue message.
    //
    // Worker endpoint example:
    // POST https://your-gpu-worker.example.com/jobs
    // { project_id, files: [...], callback_url: `${supabaseUrl}/functions/v1/worker-callback` }

    // Try to call external worker if WORKER_URL is configured
    const workerUrl = Deno.env.get("RECONSTRUCTION_WORKER_URL");
    if (workerUrl) {
      const workerApiKey = Deno.env.get("RECONSTRUCTION_WORKER_KEY") || "";
      try {
        const workerResp = await fetch(`${workerUrl}/jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${workerApiKey}`,
          },
          body: JSON.stringify({
            project_id,
            files: files?.map((f: any) => ({ url: f.file_url, type: f.file_type })),
            callback_url: `${supabaseUrl}/functions/v1/worker-callback`,
          }),
        });

        if (!workerResp.ok) {
          const errText = await workerResp.text();
          console.error("Worker error:", errText);
          // Don't fail the project - worker may retry
        } else {
          console.log("Job dispatched to worker successfully");
        }
      } catch (err) {
        console.error("Failed to dispatch to worker:", err);
        // Worker not available - project stays in processing state
        // for manual or polling-based pickup
      }
    } else {
      console.log("No RECONSTRUCTION_WORKER_URL configured. Project awaits external worker pickup.");
    }

    return new Response(JSON.stringify({ success: true, project_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("start-reconstruction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
