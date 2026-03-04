import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Check, X } from "lucide-react";
import { rims, brands, sizes, colors, type Rim } from "@/data/rims";

const CatalogPage = () => {
  const navigate = useNavigate();
  const carImage = sessionStorage.getItem("wheelVision_carImage");

  const [selectedRim, setSelectedRim] = useState<Rim | null>(null);
  const [filterSize, setFilterSize] = useState<number | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return rims.filter((r) => {
      if (filterSize && r.size !== filterSize) return false;
      if (filterColor && r.color !== filterColor) return false;
      if (filterBrand && r.brand !== filterBrand) return false;
      return true;
    });
  }, [filterSize, filterColor, filterBrand]);

  const clearFilters = () => {
    setFilterSize(null);
    setFilterColor(null);
    setFilterBrand(null);
  };

  const hasFilters = filterSize || filterColor || filterBrand;

  const handleSelect = (rim: Rim) => {
    setSelectedRim(rim);
  };

  const handleApply = () => {
    if (selectedRim) {
      sessionStorage.setItem("wheelVision_selectedRim", JSON.stringify(selectedRim));
      navigate("/result");
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container px-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Preview panel */}
          {carImage && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:w-1/2 lg:sticky lg:top-24 lg:self-start"
            >
              <div className="glass-surface rounded-2xl overflow-hidden">
                <div className="relative">
                  <img src={carImage} alt="Your car" className="w-full object-contain max-h-[400px]" />
                  {/* Rim overlay preview */}
                  {selectedRim && (
                    <>
                      <div
                        className="absolute rounded-full overflow-hidden border-2 border-primary/40 shadow-lg"
                        style={{ left: "14%", top: "52%", width: "16%", height: "auto", aspectRatio: "1" }}
                      >
                        <img src={selectedRim.image} alt={selectedRim.name} className="w-full h-full object-cover" />
                      </div>
                      <div
                        className="absolute rounded-full overflow-hidden border-2 border-primary/40 shadow-lg"
                        style={{ left: "70%", top: "52%", width: "16%", height: "auto", aspectRatio: "1" }}
                      >
                        <img src={selectedRim.image} alt={selectedRim.name} className="w-full h-full object-cover" />
                      </div>
                    </>
                  )}
                </div>
                {selectedRim && (
                  <div className="p-5 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold">{selectedRim.name}</p>
                      <p className="text-muted-foreground text-sm">{selectedRim.brand} · {selectedRim.size}"</p>
                    </div>
                    <button
                      onClick={handleApply}
                      className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Apply & Preview →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Catalog */}
          <div className={carImage ? "lg:w-1/2" : "w-full"}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-primary text-sm tracking-[0.2em] uppercase mb-1">Step 2</p>
                <h1 className="font-display text-3xl font-bold">Choose Your Rims</h1>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
              </button>
            </div>

            {/* Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <div className="glass-surface rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display font-semibold text-sm">Filters</p>
                      {hasFilters && (
                        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Size</p>
                      <div className="flex flex-wrap gap-2">
                        {sizes.map((s) => (
                          <button
                            key={s}
                            onClick={() => setFilterSize(filterSize === s ? null : s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              filterSize === s
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-muted"
                            }`}
                          >
                            {s}"
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((c) => (
                          <button
                            key={c}
                            onClick={() => setFilterColor(filterColor === c ? null : c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                              filterColor === c
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-muted"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Brand</p>
                      <div className="flex flex-wrap gap-2">
                        {brands.map((b) => (
                          <button
                            key={b}
                            onClick={() => setFilterBrand(filterBrand === b ? null : b)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              filterBrand === b
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-muted"
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((rim) => (
                <motion.button
                  key={rim.id}
                  layout
                  onClick={() => handleSelect(rim)}
                  className={`group glass-surface rounded-xl overflow-hidden text-left transition-all ${
                    selectedRim?.id === rim.id
                      ? "ring-2 ring-primary"
                      : "hover:border-muted-foreground"
                  }`}
                >
                  <div className="relative aspect-square bg-muted/30 overflow-hidden">
                    <img
                      src={rim.image}
                      alt={rim.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {selectedRim?.id === rim.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display font-semibold text-sm truncate">{rim.name}</p>
                    <p className="text-muted-foreground text-xs">{rim.brand} · {rim.size}"</p>
                    <p className="text-primary font-semibold text-sm mt-1">${rim.price.toLocaleString()}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No rims match your filters</p>
                <button onClick={clearFilters} className="text-primary text-sm mt-2">Clear filters</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
