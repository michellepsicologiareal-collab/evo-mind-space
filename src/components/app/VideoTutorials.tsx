import { useState } from "react";
import { PlayCircle, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface VideoModule {
  file: string;
  title: string;
  description: string;
  duration: string;
}

/** Demonstrações gravadas no sistema real, separadas por módulo. */
export const videoModules: VideoModule[] = [
  { file: "01-visao-geral.mp4", title: "Visão geral", description: "Login, menu lateral e como o sistema está organizado.", duration: "0:54" },
  { file: "02-painel.mp4", title: "Painel", description: "Indicadores do dia, aniversariantes e formulações pendentes.", duration: "0:22" },
  { file: "03-agenda.mp4", title: "Agenda", description: "Criar, editar e acompanhar sessões com status coloridos.", duration: "1:14" },
  { file: "04-pacientes.mp4", title: "Pacientes", description: "Cadastro clínico, prontuário por abas e lixeira de 30 dias.", duration: "0:55" },
  { file: "05-registro-sessao.mp4", title: "Registro de Sessão", description: "Preencher a sessão, salvar e atualizar o plano no drawer.", duration: "0:43" },
  { file: "06-plano-atendimento.mp4", title: "Plano de Atendimento", description: "Sessões contratadas, realizadas e restantes.", duration: "0:25" },
  { file: "07-financeiro.mp4", title: "Financeiro", description: "Resumo, filtros e baixa de pagamento direto no card.", duration: "1:16" },
  { file: "08-cobranca-whatsapp.mp4", title: "Cobrança por WhatsApp", description: "Enviar, reenviar e acompanhar o status da cobrança.", duration: "0:27" },
  { file: "09-receita-saude.mp4", title: "Receita Saúde", description: "Não emitida, Emitida e Não se aplica direto no card.", duration: "0:42" },
  { file: "10-historico-detalhes.mp4", title: "Histórico e detalhes", description: "Histórico de lembretes e financeiro por plano.", duration: "0:21" },
  { file: "11-demais-modulos.mp4", title: "Demais módulos", description: "Humor, Autocuidado, Anamneses, Termo, Contratos e Configurações.", duration: "1:13" },
];

export const VideoTutorials = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [active, setActive] = useState<{ mod: VideoModule; url: string } | null>(null);

  const openVideo = async (mod: VideoModule) => {
    setLoading(mod.file);
    const { data, error } = await supabase.storage
      .from("tutoriais")
      .createSignedUrl(mod.file, 60 * 60);
    setLoading(null);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o vídeo", description: "Tente novamente em instantes.", variant: "destructive" });
      return;
    }
    setActive({ mod, url: data.signedUrl });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-accent" />
          <h2 className="font-display text-lg font-semibold text-foreground">Demonstração do sistema</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Vídeos curtos gravados no sistema real, separados por módulo. Assista na ordem ou vá direto ao que precisa.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videoModules.map((mod, i) => (
          <li key={mod.file}>
            <button
              type="button"
              onClick={() => openVideo(mod)}
              className="group flex h-full w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-accent/60 hover:bg-accent/5"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                {loading === mod.file ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-sm font-semibold text-foreground">
                    {i + 1}. {mod.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {mod.duration}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{mod.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-4xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{active?.mod.title}</DialogTitle>
          </DialogHeader>
          {active && (
            <video
              key={active.url}
              src={active.url}
              controls
              autoPlay
              playsInline
              className="w-full rounded-xl bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VideoTutorials;
