import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an expert computer vision system specialized in detecting car wheels in photographs. 
You must identify the EXACT pixel-level center and radius of each visible wheel/rim in the image.
Return coordinates as percentages of the image dimensions (0-100).
x = horizontal position from LEFT edge as % of image WIDTH.
y = vertical position from TOP edge as % of image HEIGHT.  
radius = wheel radius as % of image WIDTH.
Be extremely precise. The center should be at the hub/axle of the wheel, and the radius should encompass the full rim (including tire).
For a typical side-view car photo, wheels are usually in the lower 60-80% of the image height.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Detect all visible wheels in this car photo. Be very precise with center positions and radius.",
              },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_wheels",
              description: "Report the precisely detected wheel positions in the car photo",
              parameters: {
                type: "object",
                properties: {
                  wheels: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        x: { type: "number", description: "Wheel center X as % of image width (0-100), measured from left edge" },
                        y: { type: "number", description: "Wheel center Y as % of image height (0-100), measured from top edge" },
                        radius: { type: "number", description: "Wheel radius as % of image width (0-100), should include the full rim and tire" },
                      },
                      required: ["x", "y", "radius"],
                      additionalProperties: false,
                    },
                  },
                  car_model: { type: "string", description: "Detected car make and model if identifiable" },
                  confidence: { type: "number", description: "Detection confidence 0-1" },
                },
                required: ["wheels", "car_model", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_wheels" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + response.status);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not parse wheel detection result");
  } catch (e) {
    console.error("detect-wheels error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
