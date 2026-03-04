import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, Check, X, RotateCcw } from "lucide-react";

export interface AnglePhoto {
  label: string;
  description: string;
  icon: string;
  image: string | null;
}

const defaultAngles: Omit<AnglePhoto, "image">[] = [
  { label: "Seitenansicht", description: "Links oder rechts", icon: "🚗" },
  { label: "Frontansicht", description: "Von vorne", icon: "🔲" },
  { label: "Heckansicht", description: "Von hinten", icon: "🔳" },
  { label: "Schrägansicht", description: "3/4 Winkel", icon: "📐" },
];

interface MultiAngleUploadProps {
  onPhotosReady: (photos: string[]) => void;
  onMainPhoto: (photo: string) => void;
}

function resizeImage(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
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
}

const MultiAngleUpload = ({ onPhotosReady, onMainPhoto }: MultiAngleUploadProps) => {
  const [photos, setPhotos] = useState<AnglePhoto[]>(
    defaultAngles.map((a) => ({ ...a, image: null }))
  );

  const uploadedCount = photos.filter((p) => p.image).length;

  const handleFile = useCallback(async (index: number, file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await resizeImage(file);
    
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], image: dataUrl };
      
      // Notify parent of main photo (first uploaded = side view preferred)
      const allPhotos = next.filter((p) => p.image).map((p) => p.image!);
      if (allPhotos.length === 1) {
        onMainPhoto(dataUrl);
      }
      
      return next;
    });
  }, [onMainPhoto]);

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], image: null };
      return next;
    });
  };

  const handleSubmit = () => {
    const allPhotos = photos.filter((p) => p.image).map((p) => p.image!);
    if (allPhotos.length > 0) {
      onPhotosReady(allPhotos);
    }
  };

  return (
    <div className="glass-surface rounded-2xl p-6 md:p-8">
      <div className="text-center mb-6">
        <p className="font-display text-xl font-bold mb-2">Fotos aus verschiedenen Winkeln</p>
        <p className="text-muted-foreground text-sm">
          Lade mindestens 1 Foto hoch — je mehr Winkel, desto besser das 3D-Modell
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {photos.map((photo, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            {photo.image ? (
              <div className="relative group aspect-square rounded-xl overflow-hidden border-2 border-primary/50">
                <img src={photo.image} alt={photo.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removePhoto(i)}
                    className="bg-destructive text-destructive-foreground p-2 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm px-2 py-1">
                  <p className="text-xs font-medium text-center truncate">{photo.label}</p>
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-secondary/30 hover:bg-secondary/50 flex flex-col items-center justify-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(i, e.target.files[0])}
                />
                <span className="text-2xl">{photo.icon}</span>
                <p className="text-xs font-display font-semibold text-foreground">{photo.label}</p>
                <p className="text-[10px] text-muted-foreground">{photo.description}</p>
              </label>
            )}
          </motion.div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {photos.map((p, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  p.image ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {uploadedCount}/4 Fotos
          </span>
        </div>
        {uploadedCount > 0 && (
          <span className="text-xs text-primary font-medium">
            {uploadedCount >= 3 ? "Optimale Qualität ✨" : uploadedCount >= 2 ? "Gute Qualität 👍" : "Mindestens 1 Foto ✓"}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {uploadedCount > 0 && (
          <button
            onClick={() => setPhotos(defaultAngles.map((a) => ({ ...a, image: null })))}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Zurücksetzen
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={uploadedCount === 0}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Camera className="w-4 h-4" />
          3D-Modell erstellen {uploadedCount > 0 && `(${uploadedCount} Foto${uploadedCount > 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
};

export default MultiAngleUpload;
