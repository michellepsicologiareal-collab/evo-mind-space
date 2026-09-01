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

        <div className="mt-8 sm:mt-10 rounded-3xl border border-border bg-card p-6 sm:p-8 text-center shadow-soft animate-fade-up">
          <h3 className="font-display text-xl sm:text-2xl font-medium text-foreground">
            Gostou do que viu? Comece hoje mesmo.
          </h3>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            6 meses de acesso completo por{" "}
            <span className="font-semibold text-foreground">R$ 58,90</span> — menos de R$ 10 por mês
          </p>
          <Button asChild variant="accent" size="lg" className="mt-6 w-full sm:w-auto">
            <a href={DEFAULT_KIWIFY_URL} target="_blank" rel="noopener noreferrer">
              Assinar 6 meses por R$ 58,90
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro via Kiwify · Acesso imediato após a confirmação
          </p>
          <p className="mt-2 text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Cobrança única de R$ 58,90 a cada 6 meses, com renovação automática pelo mesmo valor
            salvo cancelamento. Cancele quando quiser e mantenha o acesso até o fim do período pago.
          </p>
        </div>


      </div>
    </section>
  );
};
