import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MESHY_API = "https://api.meshy.ai/openapi/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_url, additional_images } = await req.json();
    if (!image_url) {
      return new Response(JSON.stringify({ error: "image_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MESHY_API_KEY = Deno.env.get("MESHY_API_KEY");
    if (!MESHY_API_KEY) throw new Error("MESHY_API_KEY not configured");

    // Use Meshy-6 for best quality
    const body: Record<string, unknown> = {
      image_url,
      ai_model: "meshy-6",
      enable_pbr: true,
      should_remesh: true,
      topology: "quad",
      target_polycount: 50000,
      should_texture: true,
      symmetry_mode: "auto",
      image_enhancement: true,
      remove_lighting: true,
    };

    // If additional images are provided, try multi-view (Meshy 5 feature)
    // Meshy 6 may not support multi-view yet, fall back gracefully
    if (additional_images && Array.isArray(additional_images) && additional_images.length > 0) {
      console.log(`Multi-view: ${additional_images.length} additional images provided`);
      // Try with multi_view_image_urls parameter
      body.multi_view_image_urls = additional_images.slice(0, 3);
    }

    console.log("Creating Meshy task with params:", JSON.stringify({ 
      ...body, 
      image_url: body.image_url?.toString().substring(0, 50) + "...",
      multi_view_image_urls: body.multi_view_image_urls ? `[${(body.multi_view_image_urls as string[]).length} images]` : undefined,
    }));

    const response = await fetch(`${MESHY_API}/image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Meshy error:", response.status, errText);
      
      // If multi-view failed, retry without it
      if (body.multi_view_image_urls) {
        console.log("Retrying without multi-view...");
        delete body.multi_view_image_urls;
        
        const retryResponse = await fetch(`${MESHY_API}/image-to-3d`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MESHY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        
        if (!retryResponse.ok) {
          const retryErr = await retryResponse.text();
          console.error("Meshy retry error:", retryResponse.status, retryErr);
          return new Response(JSON.stringify({ error: `Meshy API error: ${retryResponse.status}` }), {
            status: retryResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const retryData = await retryResponse.json();
        console.log("Meshy task created (fallback):", JSON.stringify(retryData));
        return new Response(JSON.stringify({ task_id: retryData.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: `Meshy API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Meshy task created:", JSON.stringify(data));

    return new Response(JSON.stringify({ task_id: data.result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-3d error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
