import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ShoppingCart } from "lucide-react";
import { rims, type Rim } from "@/data/rims";
import { toast } from "sonner";

interface RimConfiguratorProps {
  selectedRim: Rim | null;
  onSelectRim: (rim: Rim) => void;
}

const RimConfigurator = ({ selectedRim, onSelectRim }: RimConfiguratorProps) => {
  const [filterColor, setFilterColor] = useState<string | null>(null);

  const colorMap: Record<string, string> = {
    black: "bg-zinc-900",
    silver: "bg-zinc-400",
    chrome: "bg-gradient-to-br from-zinc-300 to-zinc-500",
    bronze: "bg-amber-700",
  };

  const colorLabels: Record<string, string> = {
    black: "Schwarz",
    silver: "Silber",
    chrome: "Chrom",
    bronze: "Bronze",
  };

  const filteredRims = filterColor
    ? rims.filter((r) => r.color === filterColor)
    : rims;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-primary">
          Felgen Konfigurator
        </h3>
        <p className="text-muted-foreground text-xs mt-1">
          Wähle deine Wunschfelge
        </p>
      </div>

      {/* Color filter */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Farbe</p>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterColor(null)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              !filterColor
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Alle
          </button>
          {Object.entries(colorLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterColor(key === filterColor ? null : key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors ${
                filterColor === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${colorMap[key]} border border-border/50`} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rim list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredRims.map((rim) => {
            const isSelected = selectedRim?.id === rim.id;
            return (
              <motion.button
                key={rim.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onSelectRim(rim)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group ${
                  isSelected
                    ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20"
                    : "bg-secondary/40 border border-transparent hover:bg-secondary hover:border-border"
                }`}
              >
                {/* Rim thumbnail */}
                <div className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border ${
                  isSelected ? "border-primary/50" : "border-border"
                }`}>
                  <img
                    src={rim.image}
                    alt={rim.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`font-display font-semibold text-sm truncate ${
                      isSelected ? "text-primary" : "text-foreground"
                    }`}>
                      {rim.name}
                    </p>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {rim.brand} · {rim.size}" · {colorLabels[rim.color] || rim.color}
                  </p>
                  <p className="text-primary font-display font-bold text-xs mt-0.5">
                    €{rim.price.toLocaleString("de-DE")}
                  </p>
                </div>

                <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${
                  isSelected ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
                }`} />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Selected rim CTA */}
      {selectedRim && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="p-4 border-t border-border"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-primary/30">
              <img src={selectedRim.image} alt={selectedRim.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold text-sm">{selectedRim.name}</p>
              <p className="text-primary font-display font-bold text-sm">
                €{selectedRim.price.toLocaleString("de-DE")}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              toast.success(`${selectedRim.name} wurde zur Anfrage hinzugefügt!`);
            }}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Angebot anfragen
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default RimConfigurator;
