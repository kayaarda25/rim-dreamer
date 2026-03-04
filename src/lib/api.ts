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

// 3D Model Generation
export async function generate3DModel(
  imageDataUrl: string,
  additionalImages?: string[]
): Promise<{ task_id: string }> {
  const body: Record<string, unknown> = { image_url: imageDataUrl };
  if (additionalImages && additionalImages.length > 0) {
    body.additional_images = additionalImages;
  }

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-3d`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "3D generation failed" }));
    throw new Error(err.error || `3D generation failed (${resp.status})`);
  }

  return resp.json();
}

export interface ThreeDStatus {
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "EXPIRED";
  progress: number;
  model_urls: { glb?: string; fbx?: string; obj?: string; usdz?: string } | null;
  thumbnail_url: string | null;
  texture_urls: Array<{ base_color?: string }> | null;
}

export async function check3DStatus(taskId: string): Promise<ThreeDStatus> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/check-3d-status`, {
    method: "POST",
    headers,
    body: JSON.stringify({ task_id: taskId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Status check failed" }));
    throw new Error(err.error || `Status check failed (${resp.status})`);
  }

  return resp.json();
}
