import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Sparkles, Eye } from "lucide-react";
import heroImage from "@/assets/hero-car.jpg";

const steps = [
  { icon: Upload, title: "Upload Photo", desc: "Take a side photo of your car" },
  { icon: Sparkles, title: "AI Detection", desc: "We detect your wheels instantly" },
  { icon: Eye, title: "Visualize", desc: "See new rims on your car" },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Luxury car with custom rims"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        </div>

        <div className="relative z-10 container px-6 text-center pt-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <p className="text-primary font-medium text-sm tracking-[0.2em] uppercase mb-4">
              AI-Powered Rim Visualization
            </p>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-6">
              See Your New Rims
              <br />
              <span className="text-gradient-gold">Before You Buy</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto mb-10">
              Upload a photo of your car and instantly preview premium rims with photorealistic AI rendering.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/upload"
                className="bg-primary text-primary-foreground px-8 py-4 rounded-xl text-base font-semibold hover:opacity-90 transition-all gold-glow"
              >
                Upload Car Photo
              </Link>
              <Link
                to="/catalog"
                className="border border-border text-foreground px-8 py-4 rounded-xl text-base font-medium hover:bg-secondary transition-colors"
              >
                Browse Catalog
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 container px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-primary text-sm tracking-[0.2em] uppercase mb-3">How It Works</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold">Three Simple Steps</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="glass-surface rounded-2xl p-8 text-center group hover:border-primary/30 transition-colors"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 container px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-surface rounded-3xl p-16 max-w-3xl mx-auto"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Visualize?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join thousands of car enthusiasts who preview their perfect rims before making a purchase.
          </p>
          <Link
            to="/upload"
            className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-xl text-base font-semibold hover:opacity-90 transition-all gold-glow"
          >
            Get Started Free
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 container px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display font-semibold text-sm">
            WheelVision <span className="text-primary">AI</span>
          </span>
          <p className="text-muted-foreground text-xs">
            © 2026 WheelVision AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
