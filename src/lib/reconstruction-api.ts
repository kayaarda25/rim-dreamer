import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export interface ReconstructionProject {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress_stage: "uploading" | "preparing_images" | "colmap" | "training_splats" | "exporting" | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  input_type: "images" | "video";
  model_url: string | null;
  preview_url: string | null;
  logs: string | null;
}

export interface ReconstructionFile {
  id: string;
  project_id: string;
  file_url: string;
  file_type: "image" | "video" | "frame";
  created_at: string;
}

/** Create a new reconstruction project */
export async function createProject(inputType: "images" | "video" = "images"): Promise<ReconstructionProject> {
  const { data, error } = await supabase
    .from("reconstruction_projects")
    .insert({ input_type: inputType, status: "queued", progress_stage: "uploading" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ReconstructionProject;
}

/** Upload a file to reconstruction storage and register it */
export async function uploadProjectFile(
  projectId: string,
  file: File,
  fileType: "image" | "video" = "image"
): Promise<ReconstructionFile> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `projects/${projectId}/raw/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("reconstructions")
    .upload(path, file, { contentType: file.type });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage
    .from("reconstructions")
    .getPublicUrl(path);

  const { data, error } = await supabase
    .from("reconstruction_files")
    .insert({
      project_id: projectId,
      file_url: urlData.publicUrl,
      file_type: fileType,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ReconstructionFile;
}

/** Start reconstruction processing */
export async function startProject(projectId: string): Promise<void> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/start-reconstruction`, {
    method: "POST",
    headers,
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Failed to start" }));
    throw new Error(err.error || `Start failed (${resp.status})`);
  }
}

/** Get project status */
export async function getProject(projectId: string): Promise<ReconstructionProject> {
  const { data, error } = await supabase
    .from("reconstruction_projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ReconstructionProject;
}

/** Get project files */
export async function getProjectFiles(projectId: string): Promise<ReconstructionFile[]> {
  const { data, error } = await supabase
    .from("reconstruction_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as ReconstructionFile[];
}
