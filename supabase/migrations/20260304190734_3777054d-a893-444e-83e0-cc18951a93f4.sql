
-- Create project status enum
CREATE TYPE public.reconstruction_status AS ENUM ('queued', 'processing', 'done', 'failed');
CREATE TYPE public.reconstruction_input_type AS ENUM ('images', 'video');
CREATE TYPE public.project_file_type AS ENUM ('image', 'video', 'frame');
CREATE TYPE public.progress_stage AS ENUM ('uploading', 'preparing_images', 'colmap', 'training_splats', 'exporting');

-- Projects table
CREATE TABLE public.reconstruction_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status reconstruction_status NOT NULL DEFAULT 'queued',
  progress_stage progress_stage DEFAULT 'uploading',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT,
  input_type reconstruction_input_type NOT NULL DEFAULT 'images',
  model_url TEXT,
  preview_url TEXT,
  logs TEXT
);

-- Project files table
CREATE TABLE public.reconstruction_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.reconstruction_projects(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type project_file_type NOT NULL DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reconstruction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconstruction_files ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required for MVP)
CREATE POLICY "Anyone can create projects" ON public.reconstruction_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view projects" ON public.reconstruction_projects FOR SELECT USING (true);
CREATE POLICY "Anyone can update projects" ON public.reconstruction_projects FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert files" ON public.reconstruction_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view files" ON public.reconstruction_files FOR SELECT USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('reconstructions', 'reconstructions', true, 104857600);

-- Storage policies
CREATE POLICY "Anyone can upload reconstruction files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reconstructions');

CREATE POLICY "Anyone can view reconstruction files"
ON storage.objects FOR SELECT
USING (bucket_id = 'reconstructions');

-- Enable realtime for status polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.reconstruction_projects;
