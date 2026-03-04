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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    // Handle signed upload URL requests
    if (action === "get_upload_url") {
      const { path } = body;
      if (!path) {
        return new Response(JSON.stringify({ error: "path is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.storage
        .from("reconstructions")
        .createSignedUploadUrl(path);

      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ signed_url: data.signedUrl, token: data.token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle file upload via callback (worker sends file here)
    if (action === "upload_file") {
      const { path, base64_data, content_type } = body;
      if (!path || !base64_data) {
        return new Response(JSON.stringify({ error: "path and base64_data required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decode base64 to binary
      const binaryStr = atob(base64_data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from("reconstructions")
        .upload(path, bytes.buffer, {
          contentType: content_type || "application/octet-stream",
          upsert: true,
        });

      if (error) throw new Error(error.message);

      const { data: urlData } = supabase.storage
        .from("reconstructions")
        .getPublicUrl(path);

      return new Response(JSON.stringify({ public_url: urlData.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: status update callback
    const { project_id, status, progress_stage, model_url, preview_url, error_message } = body;

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
