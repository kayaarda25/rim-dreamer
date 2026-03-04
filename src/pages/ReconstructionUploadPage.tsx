import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Camera, Film, AlertCircle, Loader2, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { createProject, uploadProjectFile, startProject } from "@/lib/reconstruction-api";

const MAX_FILES = 50;
const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp,image/heic";
const ACCEPTED_VIDEO = "video/mp4,video/quicktime,video/webm";

const ReconstructionUploadPage = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVideo = files.length === 1 && files[0].type.startsWith("video/");

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );

    if (arr.length === 0) return;

    // If adding a video, replace everything
    if (arr.some((f) => f.type.startsWith("video/"))) {
      const video = arr.find((f) => f.type.startsWith("video/"))!;
      setFiles([video]);
      setPreviews([URL.createObjectURL(video)]);
      return;
    }

    setFiles((prev) => {
      const combined = [...prev.filter((f) => f.type.startsWith("image/")), ...arr].slice(0, MAX_FILES);
      return combined;
    });

    setPreviews((prev) => {
      const newPreviews = arr.map((f) => URL.createObjectURL(f));
      return [...prev, ...newPreviews].slice(0, MAX_FILES);
    });
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleUploadAndStart = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const inputType = isVideo ? "video" : "images";
      const project = await createProject(inputType as "images" | "video");
      const projectId = project.id;

      // Upload files
      for (let i = 0; i < files.length; i++) {
        const fileType = files[i].type.startsWith("video/") ? "video" : "image";
        await uploadProjectFile(projectId, files[i], fileType as "image" | "video");
        setUploadProgress(Math.round(((i + 1) / files.length) * 90));
      }

      // Start processing
      await startProject(projectId);
      setUploadProgress(100);

      toast.success("Projekt erstellt! Verarbeitung gestartet...");
      navigate(`/reconstruction/${projectId}`);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 container px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="text-center mb-12">
          <p className="text-primary text-sm tracking-[0.2em] uppercase mb-3">3D Rekonstruktion</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
            Fotorealistische 3D-Modelle
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Lade 10–30 Fotos rund um dein Auto hoch oder ein kurzes Video.
            Wir erstellen automatisch ein fotorealistisches 3D-Modell.
          </p>
        </div>

        {/* Upload area */}
        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`glass-surface rounded-2xl border-2 border-dashed transition-all duration-300 ${
            dragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          {files.length === 0 ? (
            <label className="block cursor-pointer p-16 text-center">
              <input
                ref={inputRef}
                type="file"
                accept={`${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`}
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="font-display text-xl font-semibold mb-2">
                {dragActive ? "Dateien hier ablegen" : "Fotos oder Video hochladen"}
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                Drag & Drop oder klicken — JPG, PNG, MP4
              </p>
              <div className="flex items-center justify-center gap-6 text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4" /> 10–30 Fotos
                </span>
                <span className="text-border">oder</span>
                <span className="flex items-center gap-1.5">
                  <Film className="w-4 h-4" /> 1 Video
                </span>
              </div>
            </label>
          ) : (
            <div className="p-6">
              {/* File grid */}
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-6">
                {previews.map((preview, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                    {files[i]?.type.startsWith("video/") ? (
                      <video src={preview} className="w-full h-full object-cover" />
                    ) : (
                      <img src={preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm text-[10px] px-1.5 py-0.5 rounded font-medium">
                      {i + 1}
                    </div>
                  </div>
                ))}

                {/* Add more button */}
                {!isVideo && files.length < MAX_FILES && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE}
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && addFiles(e.target.files)}
                    />
                    <Upload className="w-5 h-5 mb-1" />
                    <span className="text-[10px]">Mehr</span>
                  </label>
                )}
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {files.length >= 10 ? (
                    <CheckCircle className="w-4 h-4 text-primary" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    <span className="font-semibold">{files.length}</span>{" "}
                    {isVideo ? "Video" : "Fotos"}
                    {!isVideo && files.length < 10 && (
                      <span className="text-muted-foreground ml-1">
                        (min. 10 empfohlen)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setFiles([]);
                      previews.forEach(URL.revokeObjectURL);
                      setPreviews([]);
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Zurücksetzen
                  </button>
                  <button
                    onClick={handleUploadAndStart}
                    disabled={uploading || files.length === 0}
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {uploadProgress}%
                      </>
                    ) : (
                      "3D-Modell erstellen →"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 glass-surface rounded-xl p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-display font-semibold text-sm mb-2">Tipps für beste Ergebnisse</p>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Fotografiere das Auto von allen Seiten (rundherum gehen)</li>
                <li>• 10–30 Fotos aus verschiedenen Winkeln und Höhen</li>
                <li>• Gute, gleichmäßige Beleuchtung (Tageslicht ideal)</li>
                <li>• Vermeide Bewegungsunschärfe — halte die Kamera ruhig</li>
                <li>• Überlappung zwischen Fotos für bessere Rekonstruktion</li>
                <li>• Video: langsam um das Auto herum gehen (30–60 Sek.)</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ReconstructionUploadPage;
