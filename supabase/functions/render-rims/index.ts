import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { carImage, rimImage, rimName, wheels } = await req.json();

    if (!carImage || !rimImage) {
      return new Response(JSON.stringify({ error: "Missing carImage or rimImage" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build a detailed prompt for the image editing model
    const wheelDescriptions = (wheels || [])
      .map((w: { x: number; y: number; radius: number }, i: number) =>
        `Wheel ${i + 1}: center at ${w.x}% from left, ${w.y}% from top, radius ~${w.radius}% of image width`
      )
      .join(". ");

    const prompt = `Replace the wheels/rims on this car with the new rim design shown in the second image. ${wheelDescriptions}. 
Keep the car body, background, and everything else exactly the same. 
Only replace the visible wheel rims with the new ${rimName || "rim"} design.
Match the perspective, size, and lighting of the original wheels.
The result should look photorealistic - as if the car actually has these new rims installed.
Maintain the tire rubber around the new rims.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: carImage } },
              { type: "image_url", image_url: { url: rimImage } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI render error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI render error: " + response.status);
    }

    const data = await response.json();
    console.log("Render response keys:", Object.keys(data));

    // Extract the generated image
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = data.choices?.[0]?.message?.content || "";

    if (!generatedImage) {
      console.error("No image in response. Content:", textContent);
      return new Response(
        JSON.stringify({ error: "AI could not generate the rim visualization. Try a different photo.", details: textContent }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ renderedImage: generatedImage, description: textContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("render-rims error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
