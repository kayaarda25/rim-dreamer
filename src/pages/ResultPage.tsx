import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Share2, MessageSquare, ArrowLeft, Bookmark } from "lucide-react";
import { toast } from "sonner";
import type { Rim } from "@/data/rims";

const ResultPage = () => {
  const navigate = useNavigate();
  const [carImage, setCarImage] = useState<string | null>(null);
  const [rim, setRim] = useState<Rim | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const img = sessionStorage.getItem("wheelVision_carImage");
    const rimData = sessionStorage.getItem("wheelVision_selectedRim");
    if (!img || !rimData) {
      navigate("/upload");
      return;
    }
    setCarImage(img);
    setRim(JSON.parse(rimData));
    // Simulate rendering
    setTimeout(() => setRendering(false), 2500);
  }, [navigate]);

  if (!carImage || !rim) return null;

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
                <p className="text-muted-foreground text-sm">Applying {rim.name} to your car...</p>
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

              {/* After (with rims overlaid) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img src={carImage} alt="With rims" className="w-full h-full object-contain" />
                {/* Rim overlays */}
                <div
                  className="absolute rounded-full overflow-hidden shadow-lg"
                  style={{ left: "14%", top: "52%", width: "16%", aspectRatio: "1" }}
                >
                  <img src={rim.image} alt={rim.name} className="w-full h-full object-cover" />
                </div>
                <div
                  className="absolute rounded-full overflow-hidden shadow-lg"
                  style={{ left: "70%", top: "52%", width: "16%", aspectRatio: "1" }}
                >
                  <img src={rim.image} alt={rim.name} className="w-full h-full object-cover" />
                </div>
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
                After
              </div>
            </div>
          )}
        </div>

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
                { icon: Download, label: "Download", action: () => toast.success("Image downloaded!") },
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
