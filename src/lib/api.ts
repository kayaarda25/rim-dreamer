const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export interface WheelDetection {
  wheels: Array<{ x: number; y: number; radius: number }>;
  car_model: string;
  confidence: number;
}

export async function detectWheels(imageDataUrl: string): Promise<WheelDetection> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/detect-wheels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ image: imageDataUrl }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Detection failed" }));
    throw new Error(err.error || `Detection failed (${resp.status})`);
  }

  return resp.json();
}

export async function renderRims(params: {
  carImage: string;
  rimImage: string;
  rimName: string;
  wheels: Array<{ x: number; y: number; radius: number }>;
}): Promise<{ renderedImage: string; description: string }> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/render-rims`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Rendering failed" }));
    throw new Error(err.error || `Rendering failed (${resp.status})`);
  }

  return resp.json();
}

