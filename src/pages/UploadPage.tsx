import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle, AlertCircle, Move, Car } from "lucide-react";
import { toast } from "sonner";
import { detectWheels, type WheelDetection } from "@/lib/api";

interface WheelMarker {
  x: number;
  y: number;
  radius: number;
}

/**
 * Calculates the actual rendered image bounds inside an object-contain container.
 */
function getImageBounds(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number
) {
  const containerAspect = containerW / containerH;
  const imageAspect = naturalW / naturalH;

  let renderW: number, renderH: number, offsetX: number, offsetY: number;

  if (imageAspect > containerAspect) {
    // Image is wider: full width, letterbox top/bottom
    renderW = containerW;
    renderH = containerW / imageAspect;
    offsetX = 0;
    offsetY = (containerH - renderH) / 2;
  } else {
    // Image is taller: full height, letterbox left/right
    renderH = containerH;
    renderW = containerH * imageAspect;
    offsetX = (containerW - renderW) / 2;
    offsetY = 0;
  }

  return { renderW, renderH, offsetX, offsetY };
}

const UploadPage = () => {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [wheels, setWheels] = useState<WheelMarker[]>([]);
  const [carModel, setCarModel] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [adjustMode, setAdjustMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  // Track container size
  useEffect(() => {
    if (!imgContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(imgContainerRef.current);
    return () => observer.disconnect();
  }, [image]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1200;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Get natural dimensions
    const imgEl = new Image();
    imgEl.src = dataUrl;
    await new Promise((r) => (imgEl.onload = r));
    setNaturalSize({ w: imgEl.naturalWidth, h: imgEl.naturalHeight });

    setImage(dataUrl);
    setDetected(false);
    setWheels([]);
    setError(null);
    setCarModel(null);
    setDetecting(true);

    try {
      const result: WheelDetection = await detectWheels(dataUrl);
      setWheels(result.wheels);
      setCarModel(result.car_model);
      setConfidence(result.confidence);
      setDetected(true);
      toast.success(`${result.wheels.length} Rad/Räder erkannt${result.car_model ? ` — ${result.car_model}` : ""}`);
    } catch (err) {
      console.error("Detection error:", err);
      setError(err instanceof Error ? err.message : "Erkennung fehlgeschlagen");
      toast.error("Raderkennung fehlgeschlagen. Positionen können manuell angepasst werden.");
      setWheels([
        { x: 22, y: 70, radius: 10 },
        { x: 78, y: 70, radius: 10 },
      ]);
      setDetected(true);
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const proceed = () => {
    if (image) {
      sessionStorage.setItem("wheelVision_carImage", image);
      sessionStorage.setItem("wheelVision_wheels", JSON.stringify(wheels));
      if (carModel) sessionStorage.setItem("wheelVision_carModel", carModel);
      navigate("/catalog");
    }
  };

  // Convert wheel % coordinates to pixel positions within the container,
  // accounting for object-contain letterboxing
  const getMarkerStyle = (w: WheelMarker) => {
    if (!containerSize || !naturalSize) {
      // Fallback: simple percentage
      return {
        left: `${w.x - w.radius}%`,
        top: `${w.y - w.radius}%`,
        width: `${w.radius * 2}%`,
        height: `${w.radius * 2}%`,
      };
    }

    const { renderW, renderH, offsetX, offsetY } = getImageBounds(
      containerSize.w,
      containerSize.h,
      naturalSize.w,
      naturalSize.h
    );

    // w.x/w.y are % of the image dimensions
    const centerXpx = offsetX + (w.x / 100) * renderW;
    const centerYpx = offsetY + (w.y / 100) * renderH;
    // radius is % of image width
    const radiusPx = (w.radius / 100) * renderW;

    return {
      left: `${centerXpx - radiusPx}px`,
      top: `${centerYpx - radiusPx}px`,
      width: `${radiusPx * 2}px`,
      height: `${radiusPx * 2}px`,
    };
  };

  return (
    <div className="min-h-screen pt-24 pb-16 container px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="text-center mb-12">
          <p className="text-primary text-sm tracking-[0.2em] uppercase mb-3">Step 1</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">Upload Your Car</h1>
          <p className="text-muted-foreground">Take a side photo for best results</p>
        </div>

        <AnimatePresence mode="wait">
          {!image ? (
            <motion.label
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`
                block cursor-pointer glass-surface rounded-2xl border-2 border-dashed 
                transition-all duration-300 p-20 text-center
                ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}
              `}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="font-display text-xl font-semibold mb-2">
                {dragActive ? "Drop your image" : "Drag & drop or click to upload"}
              </p>
              <p className="text-muted-foreground text-sm">PNG, JPG up to 10MB</p>
            </motion.label>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-surface rounded-2xl overflow-hidden"
            >
              <div ref={imgContainerRef} className="relative">
                <img
                  src={image}
                  alt="Your car"
                  className="w-full object-contain max-h-[500px]"
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                  }}
                />

                {/* Wheel markers - positioned with pixel precision */}
                {wheels.map((w, i) => (
                  <div
                    key={i}
                    className={`absolute border-2 rounded-full transition-all duration-500 pointer-events-none ${
                      adjustMode ? "border-primary" : "border-primary/70"
                    }`}
                    style={getMarkerStyle(w)}
                  >
                    <div className="absolute inset-0 bg-primary/10 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-primary rounded-full" />
                  </div>
                ))}

                {detecting && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="font-display font-semibold">AI erkennt Räder...</p>
                      <p className="text-muted-foreground text-sm">Foto wird mit Computer Vision analysiert</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    {detected && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-primary" />
                          <span className="text-primary font-medium">{wheels.length} Rad/Räder erkannt</span>
                          {confidence > 0 && (
                            <span className="text-muted-foreground text-xs">({Math.round(confidence * 100)}%)</span>
                          )}
                        </div>
                        {carModel && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Car className="w-3 h-3" />
                            <span>{carModel}</span>
                          </div>
                        )}
                        {error && (
                          <p className="text-destructive text-xs">{error}</p>
                        )}
                      </motion.div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {detected && (
                      <button
                        onClick={() => setAdjustMode(!adjustMode)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Move className="w-4 h-4" />
                        Adjust Wheels
                      </button>
                    )}
                    <button
                      onClick={() => { setImage(null); setDetected(false); setWheels([]); setError(null); setCarModel(null); }}
                      className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Re-upload
                    </button>
                    {detected && (
                      <button
                        onClick={proceed}
                        className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        Select Rims →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 glass-surface rounded-xl p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-display font-semibold text-sm mb-1">Tipps für beste Ergebnisse</p>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Foto von der Seite auf Radhöhe aufnehmen</li>
                <li>• Das ganze Auto sollte im Bild sichtbar sein</li>
                <li>• Gute Beleuchtung führt zu besseren Ergebnissen</li>
                <li>• AI erkennt automatisch Automodell und Radpositionen</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default UploadPage;
