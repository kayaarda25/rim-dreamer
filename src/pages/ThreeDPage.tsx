import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Box, Loader2, CheckCircle, AlertTriangle, RotateCcw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { generate3DModel, check3DStatus, renderRims, detectWheels, type ThreeDStatus } from "@/lib/api";
import ThreeDViewer from "@/components/ThreeDViewer";
import RimConfigurator from "@/components/RimConfigurator";
import { type Rim } from "@/data/rims";

const STORAGE_KEY = "threed-session";

interface StoredSession {
  image: string;
  taskId: string;
  status: ThreeDStatus | null;
}

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session: StoredSession | null) {
  if (!session) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

const ThreeDPage = () => {
  const navigate = useNavigate();
  const saved = useRef(loadSession());
  const [image, setImage] = useState<string | null>(saved.current?.image ?? null);
  const [taskId, setTaskId] = useState<string | null>(saved.current?.taskId ?? null);
  const [status, setStatus] = useState<ThreeDStatus | null>(saved.current?.status ?? null);
  const [generating, setGenerating] = useState(() => {
    const s = saved.current?.status?.status;
    return !!saved.current?.taskId && s !== "SUCCEEDED" && s !== "FAILED" && s !== "EXPIRED";
  });
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedRim, setSelectedRim] = useState<Rim | null>(null);
  const [rimRendering, setRimRendering] = useState(false);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [showRendered, setShowRendered] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (taskId && image) saveSession({ image, taskId, status });
  }, [image, taskId, status]);

  // Poll for status
  useEffect(() => {
    if (!taskId || status?.status === "SUCCEEDED") return;

    const poll = async () => {
      try {
        const result = await check3DStatus(taskId);
        setStatus(result);
        if (result.status === "SUCCEEDED") {
          setGenerating(false);
          toast.success("3D-Modell erfolgreich erstellt!");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (result.status === "FAILED" || result.status === "EXPIRED") {
          setGenerating(false);
          setError("3D-Generierung fehlgeschlagen.");
          toast.error("3D-Generierung fehlgeschlagen");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (err) { console.error("Poll error:", err); }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [taskId]);

  // Render rims when a rim is selected
  const handleSelectRim = useCallback(async (rim: Rim) => {
    setSelectedRim(rim);
    if (!image) return;

    setRimRendering(true);
    setRenderedImage(null);
    try {
      // Detect wheels first
      const detection = await detectWheels(image);
      // Render with selected rim
      const result = await renderRims({
        carImage: image,
        rimImage: rim.image,
        rimName: rim.name,
        wheels: detection.wheels,
      });
      setRenderedImage(result.renderedImage);
      setShowRendered(true);
      toast.success(`${rim.name} Vorschau erstellt!`);
    } catch (err) {
      console.error("Rim render error:", err);
      toast.error("Felgen-Vorschau konnte nicht erstellt werden");
    } finally {
      setRimRendering(false);
    }
  }, [image]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1024;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const s = maxDim / Math.max(w, h);
            w = Math.round(w * s); h = Math.round(h * s);
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    setImage(dataUrl);
    setError(null); setStatus(null); setTaskId(null);
    setSelectedRim(null); setRenderedImage(null); setShowRendered(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const startGeneration = async () => {
    if (!image) return;
    setGenerating(true); setError(null); setStatus(null);
    try {
      const result = await generate3DModel(image);
      setTaskId(result.task_id);
      toast.info("3D-Generierung gestartet — 2-5 Minuten...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generierung fehlgeschlagen");
      setGenerating(false);
      toast.error("Fehler beim Starten der 3D-Generierung");
    }
  };

  const reset = () => {
    setImage(null); setTaskId(null); setStatus(null);
    setGenerating(false); setError(null);
    setSelectedRim(null); setRenderedImage(null); setShowRendered(false);
    saveSession(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const modelUrl = status?.model_urls?.glb;

  return (
    <div className="min-h-screen pt-24 pb-16 container px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={modelUrl ? "max-w-6xl mx-auto" : "max-w-4xl mx-auto"}
      >
        <div className="text-center mb-12">
          <p className="text-primary text-sm tracking-[0.2em] uppercase mb-3">
            <Box className="w-4 h-4 inline mr-2" />
            3D-Modus
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">3D-Modell erstellen</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Lade ein Seitenfoto deines Autos hoch und wir erstellen ein drehbares 3D-Modell — wie beim Mercedes Konfigurator.
          </p>
        </div>

        {/* 3D Viewer + Configurator */}
        {modelUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 min-w-0">
                {/* Toggle between 3D and rendered rim preview */}
                {showRendered && renderedImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-border shadow-lg">
                    <img src={renderedImage} alt="Felgen Vorschau" className="w-full object-contain" />
                    <button
                      onClick={() => setShowRendered(false)}
                      className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm text-foreground px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-background transition-colors flex items-center gap-1.5"
                    >
                      <Box className="w-3.5 h-3.5" />
                      3D-Ansicht
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
                      <ThreeDViewer modelUrl={modelUrl} />
                    </div>
                    {renderedImage && (
                      <button
                        onClick={() => setShowRendered(true)}
                        className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm text-foreground px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-background transition-colors flex items-center gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Felgen-Vorschau
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span>{showRendered ? "AI-generierte Felgen-Vorschau" : "Drehe das Modell — 360° Ansicht"}</span>
                  </div>
                </div>

                {/* Rim rendering progress */}
                {rimRendering && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-surface rounded-xl p-4 mt-4 flex items-center gap-3"
                  >
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <div>
                      <p className="font-display font-semibold text-sm">Felgen werden gerendert...</p>
                      <p className="text-muted-foreground text-xs">AI erstellt eine Vorschau mit den ausgewählten Felgen</p>
                    </div>
                  </motion.div>
                )}

                {/* Selected rim info */}
                {selectedRim && !rimRendering && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-surface rounded-xl p-4 mt-4 flex items-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-primary/30 shrink-0">
                      <img src={selectedRim.image} alt={selectedRim.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Ausgewählte Felge</p>
                      <p className="font-display font-bold text-lg">{selectedRim.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {selectedRim.brand} · {selectedRim.size}" · €{selectedRim.price.toLocaleString("de-DE")}
                      </p>
                    </div>
                    {renderedImage && (
                      <button
                        onClick={() => setShowRendered(!showRendered)}
                        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                      >
                        {showRendered ? "3D zeigen" : "Vorschau"}
                      </button>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Rim Configurator */}
              <div className="lg:w-80 shrink-0">
                <div className="glass-surface rounded-2xl overflow-hidden lg:h-[calc(56.25vw*0.65)] lg:max-h-[520px] h-[400px]">
                  <RimConfigurator
                    selectedRim={selectedRim}
                    onSelectRim={handleSelectRim}
                  />
                </div>
              </div>
            </div>

            {/* Download */}
            <div className="glass-surface rounded-xl p-6 mt-6">
              <p className="font-display font-semibold text-sm mb-4">3D-Modell herunterladen</p>
              <div className="flex flex-wrap gap-3">
                {status?.model_urls?.glb && (
                  <a href={status.model_urls.glb} download className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">GLB</a>
                )}
                {status?.model_urls?.fbx && (
                  <a href={status.model_urls.fbx} download className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">FBX</a>
                )}
                {status?.model_urls?.obj && (
                  <a href={status.model_urls.obj} download className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">OBJ</a>
                )}
                {status?.model_urls?.usdz && (
                  <a href={status.model_urls.usdz} download className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">USDZ</a>
                )}
              </div>
            </div>

            <div className="text-center mt-6">
              <button onClick={reset} className="text-primary text-sm font-medium hover:underline flex items-center gap-2 mx-auto">
                <RotateCcw className="w-4 h-4" /> Neues Foto hochladen
              </button>
            </div>
          </motion.div>
        )}

        {/* Upload / Generation UI */}
        {!modelUrl && (
          <AnimatePresence mode="wait">
            {!image ? (
              <motion.label
                key="upload-3d"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`block cursor-pointer glass-surface rounded-2xl border-2 border-dashed transition-all duration-300 p-16 text-center
                  ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}
              >
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <p className="font-display text-xl font-semibold mb-2">Autofoto hochladen</p>
                <p className="text-muted-foreground text-sm mb-4">Am besten ein klares Seitenfoto vor neutralem Hintergrund</p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="px-3 py-1 rounded-full bg-secondary">PNG / JPG</span>
                  <span className="px-3 py-1 rounded-full bg-secondary">Max 10MB</span>
                  <span className="px-3 py-1 rounded-full bg-secondary">Seitenansicht</span>
                </div>
              </motion.label>
            ) : (
              <motion.div key="preview-3d" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-surface rounded-2xl overflow-hidden">
                <div className="relative">
                  <img src={image} alt="Dein Auto" className="w-full object-contain max-h-[400px]" />
                  {generating && (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                        <p className="font-display text-lg font-semibold mb-2">3D-Modell wird generiert...</p>
                        <p className="text-muted-foreground text-sm mb-3">
                          {status?.status === "IN_PROGRESS" ? `Fortschritt: ${status.progress}%` : "Warte auf Verarbeitung..."}
                        </p>
                        {status?.progress !== undefined && status.progress > 0 && (
                          <div className="w-48 mx-auto h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${status.progress}%` }} transition={{ duration: 0.5 }} />
                          </div>
                        )}
                        <p className="text-muted-foreground text-xs mt-3">Dies kann 2-5 Minuten dauern</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-border">
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive mb-4">
                      <AlertTriangle className="w-4 h-4" /><span>{error}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={reset} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">Anderes Foto</button>
                    {!generating && (
                      <button onClick={startGeneration} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                        <Box className="w-4 h-4" />3D-Modell erstellen
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-8 glass-surface rounded-xl p-6">
          <p className="font-display font-semibold text-sm mb-3">So funktioniert's</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Foto hochladen", desc: "Ein klares Seitenfoto deines Autos" },
              { step: "2", title: "AI generiert 3D", desc: "Meshy AI erstellt ein 3D-Modell (2-5 Min.)" },
              { step: "3", title: "Felgen auswählen", desc: "Wähle Felgen und sieh die AI-Vorschau" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-display font-bold text-sm">{item.step}</span>
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ThreeDPage;
