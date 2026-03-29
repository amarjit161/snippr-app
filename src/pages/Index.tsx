import { motion } from "framer-motion";
import { Search, Scissors, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/salon-1.jpg";
import Header from "@/components/Header";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
           <img src={heroImage} alt="Salon interior" className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/70 to-foreground/30" />
        </div>
        <div className="container relative z-10 py-20">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-sm mb-6">
                <Sparkles className="h-4 w-4" /> AI-Powered Queue Management
              </span>
            </motion.div>
            <motion.h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
              Skip the Wait.<br />
              <span className="gradient-primary bg-clip-text text-transparent">Cut the Queue.</span>
            </motion.h1>
            <motion.p className="text-lg md:text-xl mb-8 max-w-lg text-slate-300" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              Join the live queue from anywhere. Get real-time wait estimates powered by AI. Walk in right on time.
            </motion.p>
            <motion.div className="flex flex-col sm:flex-row gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
              <Button size="lg" onClick={() => navigate("/auth?role=customer")} className="h-12 px-8 text-base">
                <Search className="mr-2 h-5 w-5" /> Find a Salon
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/auth?role=owner")} className="h-12 px-8 text-base border-primary-foreground/30 text-white hover:bg-white/10 hover:text-white">
                <Scissors className="mr-2 h-5 w-5" /> I'm a Salon Owner
              </Button>
            </motion.div>
            <motion.div className="flex gap-8 mt-12 text-slate-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /><span className="text-sm font-medium">Real-time ETA</span></div>
              <div className="flex items-center gap-2"><Scissors className="h-4 w-4 text-accent" /><span className="text-sm font-medium">500+ Salons</span></div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
