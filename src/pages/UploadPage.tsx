import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image, CheckCircle, AlertCircle, Move } from "lucide-react";

interface WheelMarker {
  x: number;
  y: number;
  radius: number;
}

const UploadPage = () => {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [wheels, setWheels] = useState<WheelMarker[]>([]);
  const [adjustMode, setAdjustMode] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setDetected(false);
      setWheels([]);
      // Simulate AI wheel detection
      setDetecting(true);
      setTimeout(() => {
        setWheels([
          { x: 22, y: 68, radius: 8 },
          { x: 78, y: 68, radius: 8 },
        ]);
        setDetecting(false);
        setDetected(true);
      }, 2000);
    };
    reader.readAsDataURL(file);
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
      navigate("/catalog");
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
              <div className="relative">
                <img src={image} alt="Your car" className="w-full object-contain max-h-[500px]" />

                {/* Wheel markers */}
                {wheels.map((w, i) => (
                  <div
                    key={i}
                    className={`absolute border-2 rounded-full transition-all duration-500 ${
                      adjustMode ? "border-primary cursor-move" : "border-primary/60"
                    }`}
                    style={{
                      left: `${w.x - w.radius}%`,
                      top: `${w.y - w.radius}%`,
                      width: `${w.radius * 2}%`,
                      height: `${w.radius * 2}%`,
                    }}
                  >
                    <div className="absolute inset-0 bg-primary/10 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-primary rounded-full" />
                  </div>
                ))}

                {/* Detecting overlay */}
                {detecting && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="font-display font-semibold">Detecting wheels...</p>
                      <p className="text-muted-foreground text-sm">AI is analyzing your photo</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-6 border-t border-border">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    {detected && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-primary font-medium">{wheels.length} wheels detected</span>
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
                      onClick={() => { setImage(null); setDetected(false); setWheels([]); }}
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
              <p className="font-display font-semibold text-sm mb-1">Tips for best results</p>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Take the photo from the side at wheel height</li>
                <li>• Ensure the full car is visible in the frame</li>
                <li>• Good lighting produces better results</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default UploadPage;
