import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Share2, MessageSquare, ArrowLeft, Bookmark, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { renderRims } from "@/lib/api";
import type { Rim } from "@/data/rims";

const ResultPage = () => {
  const navigate = useNavigate();
  const [carImage, setCarImage] = useState<string | null>(null);
  const [rim, setRim] = useState<Rim | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [rendering, setRendering] = useState(true);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Preparing AI rendering...");

  useEffect(() => {
    const img = sessionStorage.getItem("wheelVision_carImage");
    const rimData = sessionStorage.getItem("wheelVision_selectedRim");
    const wheelsData = sessionStorage.getItem("wheelVision_wheels");

    if (!img || !rimData) {
      navigate("/upload");
      return;
    }

    setCarImage(img);
    const parsedRim = JSON.parse(rimData);
    setRim(parsedRim);
    const wheels = wheelsData ? JSON.parse(wheelsData) : [];

    // Call real AI rendering
    const doRender = async () => {
      try {
        setStatusText("AI is replacing your rims...");

        // We need the rim image as a data URL. The rim.image is a module import (local path).
        // Fetch it and convert to base64.
        const rimImageUrl = parsedRim.image;
        let rimBase64 = rimImageUrl;

        // If it's not already a data URL, fetch and convert
        if (!rimImageUrl.startsWith("data:")) {
          try {
            const resp = await fetch(rimImageUrl);
            const blob = await resp.blob();
            rimBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch {
            // If fetch fails, use the URL directly
            rimBase64 = rimImageUrl;
          }
        }

        setStatusText("Generating photorealistic visualization...");

        const result = await renderRims({
          carImage: img,
          rimImage: rimBase64,
          rimName: parsedRim.name,
          wheels,
        });

        setRenderedImage(result.renderedImage);
        toast.success("AI rendering complete!");
      } catch (err) {
        console.error("Render error:", err);
        setRenderError(err instanceof Error ? err.message : "Rendering failed");
        toast.error("AI rendering failed. Showing overlay preview instead.");
      } finally {
        setRendering(false);
      }
    };

    doRender();
  }, [navigate]);

  const handleDownload = () => {
    const imageToDownload = renderedImage || carImage;
    if (!imageToDownload) return;
    const link = document.createElement("a");
    link.href = imageToDownload;
    link.download = `wheelvision-${rim?.name || "custom"}.png`;
    link.click();
    toast.success("Image downloaded!");
  };

  if (!carImage || !rim) return null;

  const wheels = JSON.parse(sessionStorage.getItem("wheelVision_wheels") || "[]");

  return (
    <div className="min-h-screen pt-24 pb-16 container px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/catalog")}
            className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-primary text-sm tracking-[0.2em] uppercase">Result</p>
            <h1 className="font-display text-3xl font-bold">Your Custom Look</h1>
          </div>
        </div>

        {/* Before / After Slider */}
        <div className="glass-surface rounded-2xl overflow-hidden mb-8">
          {rendering ? (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <p className="font-display text-xl font-semibold mb-2">Rendering your visualization</p>
                <p className="text-muted-foreground text-sm">{statusText}</p>
                <p className="text-muted-foreground text-xs mt-2">This may take 15-30 seconds...</p>
              </div>
            </div>
          ) : (
            <div
              className="relative aspect-video cursor-col-resize select-none overflow-hidden"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setSliderPos(((e.clientX - rect.left) / rect.width) * 100);
              }}
              onTouchMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const touch = e.touches[0];
                setSliderPos(((touch.clientX - rect.left) / rect.width) * 100);
              }}
            >
              {/* Before (original) */}
              <img src={carImage} alt="Original" className="absolute inset-0 w-full h-full object-contain" />

              {/* After */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                {renderedImage ? (
                  <img src={renderedImage} alt="AI rendered with new rims" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <img src={carImage} alt="With rims overlay" className="w-full h-full object-contain" />
                    {wheels.map((w: { x: number; y: number; radius: number }, i: number) => (
                      <div
                        key={i}
                        className="absolute rounded-full overflow-hidden shadow-lg"
                        style={{
                          left: `${w.x - w.radius}%`,
                          top: `${w.y - w.radius}%`,
                          width: `${w.radius * 2}%`,
                          height: `${w.radius * 2}%`,
                        }}
                      >
                        <img src={rim.image} alt={rim.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Slider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-foreground/80 z-10"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-foreground rounded-full flex items-center justify-center">
                  <span className="text-background text-xs font-bold">↔</span>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-4 left-4 bg-background/70 backdrop-blur px-3 py-1 rounded-full text-xs font-medium">
                Before
              </div>
              <div className="absolute top-4 right-4 bg-primary/80 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground">
                {renderedImage ? "AI Rendered" : "Overlay Preview"}
              </div>
            </div>
          )}
        </div>

        {/* Error notice */}
        {renderError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-surface rounded-xl p-4 mb-6 border border-destructive/30"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-display font-semibold text-sm">AI rendering encountered an issue</p>
                <p className="text-muted-foreground text-xs mt-1">{renderError}</p>
                <p className="text-muted-foreground text-xs mt-1">Showing overlay preview instead. The final product will look more realistic.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Rim info + actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-surface rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted">
                <img src={rim.image} alt={rim.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{rim.name}</h3>
                <p className="text-muted-foreground text-sm">{rim.brand} · {rim.size}" · {rim.color}</p>
                <p className="text-primary font-bold text-lg">${rim.price.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="glass-surface rounded-xl p-6">
            <p className="font-display font-semibold text-sm mb-4">Actions</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Download, label: "Download", action: handleDownload },
                { icon: Share2, label: "Share", action: () => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); } },
                { icon: MessageSquare, label: "Request Quote", action: () => toast.success("Quote request sent!") },
                { icon: Bookmark, label: "Save Config", action: () => toast.success("Configuration saved!") },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  className="flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <btn.icon className="w-4 h-4" />
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Try different */}
        <div className="text-center mt-12">
          <Link
            to="/catalog"
            className="text-primary text-sm font-medium hover:underline"
          >
            ← Try different rims
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ResultPage;
