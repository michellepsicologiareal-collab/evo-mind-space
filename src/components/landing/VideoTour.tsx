import { Play, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_KIWIFY_URL } from "@/lib/subscription";

const VIDEO_URL = "/__l5e/assets-v1/f32fd9bb-8c73-4e29-a2c2-66d0086f8834/psireal-comercial.mp4";


export const VideoTour = () => {
  return (
    <section id="conheca" className="py-16 sm:py-20 lg:py-28 bg-background">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12 animate-fade-up">
          <p className="text-sm font-medium tracking-wider uppercase text-accent mb-3 inline-flex items-center gap-2">
            <Play className="h-3.5 w-3.5" /> Tour pelo sistema
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-foreground text-balance">
            Veja o PsiReal funcionando por dentro
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Um tour rápido pelas telas reais do sistema: agenda, pacientes, registros clínicos e financeiro — tudo em um só lugar.
          </p>
        </div>

        <div className="relative rounded-3xl overflow-hidden shadow-elegant border border-border bg-card animate-fade-up">
          <video
            src={VIDEO_URL}
            poster="/__l5e/assets-v1/740eaa40-4fcd-4792-9504-2d94a50d8e6c/psireal-comercial-poster.jpg"
            controls
            playsInline
            preload="metadata"
            className="w-full aspect-video block"
          >
            Seu navegador não suporta vídeo HTML5.
          </video>
        </div>
      </div>
    </section>
  );
};
