import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Features } from "@/components/landing/Features";
import { Differential } from "@/components/landing/Differential";
import { ForWhom } from "@/components/landing/ForWhom";
import { CTA } from "@/components/landing/CTA";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Features />
        <Differential />
        <ForWhom />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
