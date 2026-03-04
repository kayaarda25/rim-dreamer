import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RotateCcw, Camera, Share2, Download, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { getProject, type ReconstructionProject } from "@/lib/reconstruction-api";

const ReconstructionViewerPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ReconstructionProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then((p) => {
        setProject(p);
        if (p.status !== "done" || !p.model_url) {
          navigate(`/reconstruction/${projectId}`, { replace: true });
        }
      })
      .catch(() => navigate("/reconstruction/new"));
  }, [projectId, navigate]);

  // Initialize Gaussian Splat viewer
  useEffect(() => {
    if (!project?.model_url || !viewerContainerRef.current) return;

    let viewer: any = null;

    const initViewer = async () => {
      try {
        const GaussianSplats3D = await import("@mkkellogg/gaussian-splats-3d");

        viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, 0],
          initialCameraPosition: [0, -2, 6],
          initialCameraLookAt: [0, 0, 0],
          rootElement: viewerContainerRef.current!,
          selfDrivenMode: true,
          useBuiltInControls: true,
          dynamicScene: false,
        });

        await viewer.addSplatScene(project.model_url, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: true,
          progressiveLoad: true,
        });

        viewerRef.current = viewer;
        setLoading(false);
      } catch (err) {
        console.error("Viewer init error:", err);
        // Fallback: try loading as GLB with Three.js
        setLoading(false);
        toast.error("3D-Viewer konnte nicht geladen werden");
      }
    };

    initViewer();

    return () => {
      if (viewer?.dispose) viewer.dispose();
    };
  }, [project?.model_url]);

  const handleScreenshot = useCallback(() => {
    const canvas = viewerContainerRef.current?.querySelector("canvas");
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `3d-car-${projectId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Screenshot gespeichert!");
    });
  }, [projectId]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link kopiert!");
    });
  }, []);

  const handleDownload = useCallback(() => {
    if (!project?.model_url) return;
    const a = document.createElement("a");
    a.href = project.model_url;
    a.download = `3d-car-${projectId}.splat`;
    a.click();
    toast.success("Download gestartet!");
  }, [project?.model_url, projectId]);

  const toggleFullscreen = useCallback(() => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return (
    <div className="min-h-screen pt-20 pb-8 container px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">3D-Ansicht</h1>
            <p className="text-muted-foreground text-sm">Drehen, zoomen, erkunden</p>
          </div>
          <button
            onClick={() => navigate("/reconstruction/new")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Neues Projekt
          </button>
        </div>

        {/* Viewer */}
        <div className="relative glass-surface rounded-2xl overflow-hidden border border-border shadow-lg">
          <div
            ref={viewerContainerRef}
            className="w-full aspect-[16/9] bg-background"
            style={{ minHeight: 400 }}
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                <p className="font-display font-semibold">3D-Modell wird geladen...</p>
                <p className="text-muted-foreground text-xs mt-1">Gaussian Splatting Viewer</p>
              </div>
            </div>
          )}

          {/* Viewer controls overlay */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors"
              title={fullscreen ? "Vollbild verlassen" : "Vollbild"}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          <button
            onClick={handleScreenshot}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            <Camera className="w-4 h-4" />
            Screenshot
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Link teilen
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            3D herunterladen
          </button>
        </div>

        {/* Preview image */}
        {project?.preview_url && (
          <div className="mt-6 glass-surface rounded-xl p-4">
            <p className="font-display font-semibold text-sm mb-3">Vorschau</p>
            <img
              src={project.preview_url}
              alt="3D Preview"
              className="rounded-lg w-full max-w-md mx-auto"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReconstructionViewerPage;
