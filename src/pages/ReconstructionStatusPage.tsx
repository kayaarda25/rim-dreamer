import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Camera, Cpu, Box, Sparkles, Download } from "lucide-react";
import { getProject, type ReconstructionProject } from "@/lib/reconstruction-api";
import { supabase } from "@/integrations/supabase/client";

const STAGES = [
  { key: "uploading", label: "Hochladen", icon: Download, desc: "Dateien werden übertragen..." },
  { key: "preparing_images", label: "Bilder vorbereiten", icon: Camera, desc: "EXIF-Rotation, Größenanpassung..." },
  { key: "colmap", label: "Kameraposen berechnen", icon: Cpu, desc: "COLMAP schätzt die 3D-Positionen..." },
  { key: "training_splats", label: "3D Gaussian Splatting", icon: Sparkles, desc: "Fotorealistische 3D-Rekonstruktion..." },
  { key: "exporting", label: "Exportieren & Optimieren", icon: Box, desc: "Modell für Web-Viewer aufbereiten..." },
] as const;

const ReconstructionStatusPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ReconstructionProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then(setProject)
      .catch((err) => setError(err.message));
  }, [projectId]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reconstruction_projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          setProject(payload.new as unknown as ReconstructionProject);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Also poll as fallback
  useEffect(() => {
    if (!projectId || project?.status === "done" || project?.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const p = await getProject(projectId);
        setProject(p);
      } catch { /* ignore */ }
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId, project?.status]);

  // Redirect to viewer when done
  useEffect(() => {
    if (project?.status === "done" && project.model_url) {
      navigate(`/reconstruction/${projectId}/view`, { replace: true });
    }
  }, [project?.status, project?.model_url, projectId, navigate]);

  const currentStageIndex = project?.progress_stage
    ? STAGES.findIndex((s) => s.key === project.progress_stage)
    : 0;

  return (
    <div className="min-h-screen pt-24 pb-16 container px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
            {project?.status === "failed" ? "Rekonstruktion fehlgeschlagen" : "3D wird erstellt..."}
          </h1>
          <p className="text-muted-foreground">
            {project?.status === "failed"
              ? "Leider ist ein Fehler aufgetreten."
              : "Dein fotorealistisches 3D-Modell wird automatisch erstellt."}
          </p>
        </div>

        {/* Progress stages */}
        <div className="glass-surface rounded-2xl p-8">
          <div className="space-y-1">
            {STAGES.map((stage, i) => {
              const isActive = i === currentStageIndex && project?.status === "processing";
              const isDone = i < currentStageIndex || project?.status === "done";
              const isFailed = project?.status === "failed" && i === currentStageIndex;
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex items-start gap-4 py-3">
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle className="w-6 h-6 text-primary" />
                    ) : isActive ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : isFailed ? (
                      <XCircle className="w-6 h-6 text-destructive" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-border" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isDone ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground"}`} />
                      <p
                        className={`font-display font-semibold text-sm ${
                          isDone ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {stage.label}
                      </p>
                    </div>
                    {(isActive || isFailed) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-muted-foreground text-xs mt-1 ml-6"
                      >
                        {isFailed ? project?.error_message || "Unbekannter Fehler" : stage.desc}
                      </motion.p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failed state guidance */}
        {project?.status === "failed" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glass-surface rounded-xl p-6"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-display font-semibold text-sm mb-2">Mögliche Ursachen</p>
                <ul className="text-muted-foreground text-sm space-y-1">
                  <li>• Zu wenige Fotos — versuche mindestens 15–20 Bilder</li>
                  <li>• Zu wenig Überlappung zwischen den Fotos</li>
                  <li>• Schlechte Beleuchtung oder starke Reflexionen</li>
                  <li>• Bewegungsunschärfe in den Bildern</li>
                  <li>• Zu wenige unterschiedliche Blickwinkel</li>
                </ul>
                <button
                  onClick={() => navigate("/reconstruction/new")}
                  className="mt-4 bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Neuen Versuch starten
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Estimated time */}
        {project?.status !== "failed" && (
          <div className="mt-6 text-center text-muted-foreground text-sm">
            <p>Geschätzte Zeit: 5–15 Minuten je nach Bildanzahl</p>
            <p className="text-xs mt-1">Du kannst diese Seite verlassen — wir verarbeiten im Hintergrund.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReconstructionStatusPage;
