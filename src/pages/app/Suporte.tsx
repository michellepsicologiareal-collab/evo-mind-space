import { MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";

const WHATSAPP_SUPPORT_URL = "https://wa.me/5511947388423";

export default function Suporte() {
  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <PageHeader
        title="Suporte"
        subtitle="Estamos aqui para ajudar você a aproveitar o PsiReal da melhor forma."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 max-w-4xl">
        {/* Dúvidas e suporte */}
        <section className="rounded-2xl bg-card border border-border p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              💬 Dúvidas e suporte
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Precisa de ajuda com o PsiReal? Fale conosco pelo WhatsApp.
          </p>
        </section>

        {/* Cancelamento da assinatura */}
        <section className="rounded-2xl bg-card border border-border p-6 shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-[hsl(var(--gold))]">
              <RefreshCw className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              🔄 Cancelamento da assinatura
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para solicitar o cancelamento da sua assinatura semestral, entre em
            contato pelo WhatsApp antes da próxima renovação.
          </p>
        </section>
      </div>

      <div className="mt-8 max-w-4xl">
        <Button variant="accent" size="lg" asChild className="w-full sm:w-auto">
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            Falar pelo WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
