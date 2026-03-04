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

    // Build content array - use data URIs for both images
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: carImage } },
    ];

    // Only add rim image if it's a valid data URI or URL
    if (rimImage.startsWith("data:") || rimImage.startsWith("http")) {
      content.push({ type: "image_url", image_url: { url: rimImage } });
    } else {
      console.warn("Rim image is not a valid URL or data URI, skipping:", rimImage.substring(0, 50));
    }

    console.log("Sending render request with", content.length, "content items");
    console.log("Car image type:", carImage.substring(0, 30));
    console.log("Rim image type:", rimImage.substring(0, 30));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI render error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es in einer Minute erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Credits aufgebraucht." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI render error: " + response.status);
    }

    const data = await response.json();
    console.log("Render response received");

    // Extract image from response
    const choice = data.choices?.[0]?.message;
    let generatedImage: string | null = null;

    // Check various response formats
    if (choice?.images?.[0]?.image_url?.url) {
      generatedImage = choice.images[0].image_url.url;
    } else if (choice?.content) {
      // Check if content contains inline base64 image
      const content = typeof choice.content === "string" ? choice.content : "";
      const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (base64Match) {
        generatedImage = base64Match[0];
      }
    }

    const textContent = typeof choice?.content === "string" ? choice.content : "";

    if (!generatedImage) {
      console.error("No image in response. Keys:", JSON.stringify(Object.keys(data)));
      console.error("Choice keys:", choice ? JSON.stringify(Object.keys(choice)) : "no choice");
      return new Response(
        JSON.stringify({ error: "AI konnte keine Felgen-Vorschau erstellen. Versuche ein anderes Foto.", details: textContent }),
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
