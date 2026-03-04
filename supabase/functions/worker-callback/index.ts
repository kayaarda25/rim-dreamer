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
    const body = await req.json();
    const { project_id, status, progress_stage, model_url, preview_url, error_message } = body;

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) update.status = status;
    if (progress_stage) update.progress_stage = progress_stage;
    if (model_url) update.model_url = model_url;
    if (preview_url) update.preview_url = preview_url;
    if (error_message !== undefined) update.error_message = error_message;

    const { error: updateError } = await supabase
      .from("reconstruction_projects")
      .update(update)
      .eq("id", project_id);

    if (updateError) throw new Error(updateError.message);

    console.log(`Worker callback for ${project_id}: status=${status}, stage=${progress_stage}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("worker-callback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
