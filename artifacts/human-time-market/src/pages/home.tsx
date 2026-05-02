import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/navbar";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Clock, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl space-y-6"
            >
              <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary" data-testid="hero-badge">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
                MARKET LIVE
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight font-mono text-balance" data-testid="hero-title">
                Trade The Most <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Finite Resource.</span>
              </h1>
              <p className="text-xl text-muted-foreground md:text-2xl leading-relaxed max-w-2xl" data-testid="hero-subtitle">
                A capital-markets-grade platform for professional time. Sell commitments to your future hours. Buy expert attention at market rates.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/sign-up">
                  <Button size="lg" className="h-12 px-8 font-mono text-base" data-testid="hero-cta-primary">
                    Open Account <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/price-index">
                  <Button size="lg" variant="outline" className="h-12 px-8 font-mono text-base" data-testid="hero-cta-secondary">
                    View Price Index
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-b border-border bg-card/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
              {[
                { label: "INDEX VALUE", value: "1,204.50", trend: "+2.4%" },
                { label: "MARKET VOL", value: "$4.2M", trend: "+12%" },
                { label: "ACTIVE PROS", value: "8,432", trend: "+145" },
                { label: "HOURS CLEARED", value: "142K", trend: "0" },
              ].map((stat, i) => (
                <div key={i} className="py-6 px-4 md:px-8 text-center md:text-left">
                  <p className="text-xs font-mono text-muted-foreground mb-1">{stat.label}</p>
                  <div className="flex items-baseline justify-center md:justify-start gap-2">
                    <p className="text-2xl font-mono font-semibold">{stat.value}</p>
                    {stat.trend !== "0" && (
                      <span className="text-xs font-mono text-primary">{stat.trend}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-16 text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4">Terminal Precision. Human Attention.</h2>
              <p className="text-muted-foreground text-lg">Not a gig platform. A structured marketplace where professionals control their capacity and buyers secure guaranteed execution.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <BarChart3 className="h-6 w-6 text-primary" />,
                  title: "Transparent Discovery",
                  desc: "Real-time pricing for professional skills. View historical rates, capacity constraints, and market depth."
                },
                {
                  icon: <Clock className="h-6 w-6 text-primary" />,
                  title: "Future Commitments",
                  desc: "Purchase guaranteed blocks of time in advance. Lock in rates today for execution tomorrow."
                },
                {
                  icon: <ShieldCheck className="h-6 w-6 text-primary" />,
                  title: "Guaranteed Execution",
                  desc: "Capital-grade escrow ensures professionals are paid and buyers receive their committed attention."
                }
              ].map((feature, i) => (
                <div key={i} className="p-8 rounded-xl bg-card border border-border flex flex-col items-start hover:border-primary/50 transition-colors">
                  <div className="p-3 bg-primary/10 rounded-lg mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 font-mono">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold tracking-tight">HTM TERMINAL</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Human Time Market. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
