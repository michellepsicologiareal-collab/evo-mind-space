import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayCircle, Loader2, Clock, CheckCircle2, ListVideo, Captions, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { tutorialTranscripts, type Cue } from "@/data/tutorialTranscripts";

interface VideoModule {
  file: string;
  title: string;
  description: string;
  duration: string;
  seconds: number;
}

/** Demonstrações gravadas no sistema real, separadas por módulo. */
export const videoModules: VideoModule[] = [
  { file: "01-visao-geral.mp4", title: "Visão geral", description: "Comece por aqui: login, menu lateral e como o sistema está organizado.", duration: "0:54", seconds: 54 },
  { file: "02-painel.mp4", title: "Painel", description: "Veja os indicadores do dia, aniversariantes e o que está pendente.", duration: "0:22", seconds: 22 },
  { file: "03-agenda.mp4", title: "Agenda", description: "Crie, edite e acompanhe sessões com status coloridos.", duration: "1:14", seconds: 74 },
  { file: "04-pacientes.mp4", title: "Pacientes", description: "Cadastre pacientes e navegue pelo prontuário por abas.", duration: "0:55", seconds: 55 },
  { file: "05-registro-sessao.mp4", title: "Registro de Sessão", description: "Registre o atendimento e atualize o plano sem sair da tela.", duration: "0:43", seconds: 43 },
  { file: "06-plano-atendimento.mp4", title: "Plano de Atendimento", description: "Controle sessões contratadas, realizadas e restantes.", duration: "0:25", seconds: 25 },
  { file: "12-formulacao-caso.mp4", title: "Formulação de Caso", description: "Monte a formulação nos modelos TCC, Terapia do Esquema e ACT.", duration: "1:34", seconds: 95 },
  { file: "13-tcc-atividades.mp4", title: "Registro TCC e atividades", description: "Envie um registro TCC para o paciente preencher entre as sessões.", duration: "1:02", seconds: 63 },
  { file: "14-resumo-ia.mp4", title: "Resumo com IA", description: "Gere um resumo clínico de apoio a partir dos registros do paciente.", duration: "0:49", seconds: 49 },
  { file: "07-financeiro.mp4", title: "Financeiro", description: "Acompanhe o mês, filtre e dê baixa no pagamento pelo card.", duration: "1:16", seconds: 76 },
  { file: "08-cobranca-whatsapp.mp4", title: "Cobrança por WhatsApp", description: "Envie, reenvie e acompanhe o status de cada cobrança.", duration: "0:27", seconds: 27 },
  { file: "09-receita-saude.mp4", title: "Receita Saúde", description: "Marque Não emitida, Emitida ou Não se aplica direto no card.", duration: "0:42", seconds: 42 },
  { file: "10-historico-detalhes.mp4", title: "Histórico e detalhes", description: "Consulte lembretes enviados e o financeiro por plano.", duration: "0:21", seconds: 21 },
  { file: "15-humor-pacientes.mp4", title: "Humor dos Pacientes", description: "Acompanhe a evolução do humor entre as sessões.", duration: "0:40", seconds: 40 },
  { file: "16-autocuidado.mp4", title: "Autocuidado do Terapeuta", description: "Faça seu check-in e acompanhe seus padrões no heatmap.", duration: "0:32", seconds: 33 },
  { file: "17-anamneses.mp4", title: "Anamneses", description: "Envie a anamnese de adulto ou criança e receba as respostas.", duration: "0:31", seconds: 32 },
  { file: "18-termo-consentimento.mp4", title: "Termo de Consentimento", description: "Monte o modelo com suas cláusulas e gere o link de assinatura.", duration: "0:42", seconds: 43 },
  { file: "19-contratos.mp4", title: "Contratos", description: "Veja os termos já assinados e consulte cada documento.", duration: "0:36", seconds: 37 },
  { file: "20-lixeira.mp4", title: "Lixeira de pacientes", description: "Entenda como excluir, restaurar e recuperar pacientes por até 30 dias.", duration: "1:48", seconds: 109 },
  { file: "11-demais-modulos.mp4", title: "Outros módulos e ajustes", description: "Supervisão, configurações, metas e preferências do sistema.", duration: "1:13", seconds: 73 },
];

interface ProgressRow {
  module_file: string;
  last_position: number;
  last_chapter: string | null;
  completed: boolean;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const vttTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec}`;
};

const buildVttUrl = (cues: Cue[]) => {
  const body = cues
    .map((c, i) => `${i + 1}\n${vttTime(c.s)} --> ${vttTime(c.e)}\n${c.text}\n`)
    .join("\n");
  return URL.createObjectURL(new Blob([`WEBVTT\n\n${body}`], { type: "text/vtt" }));
};

export const VideoTutorials = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [active, setActive] = useState<{ mod: VideoModule; url: string; resumeAt: number } | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [current, setCurrent] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSaved = useRef(0);
  const cueRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const data = active ? tutorialTranscripts[active.mod.file] : undefined;
  const cues = data?.cues ?? [];
  const chapters = data?.chapters ?? [];

  const vttUrl = useMemo(() => (cues.length ? buildVttUrl(cues) : null), [cues]);
  useEffect(() => () => { if (vttUrl) URL.revokeObjectURL(vttUrl); }, [vttUrl]);

  const loadProgress = useCallback(async () => {
    const { data: rows } = await supabase
      .from("tutorial_progress")
      .select("module_file, last_position, last_chapter, completed");
    if (rows) {
      setProgress(Object.fromEntries((rows as ProgressRow[]).map((r) => [r.module_file, r])));
    }
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const chapterAt = useCallback(
    (t: number) => [...chapters].reverse().find((c) => t + 0.25 >= c.t)?.title ?? null,
    [chapters],
  );

  const activeCueIndex = useMemo(
    () => cues.findIndex((c) => current >= c.s - 0.2 && current <= c.e + 0.2),
    [cues, current],
  );

  useEffect(() => {
    if (activeCueIndex < 0) return;
    cueRefs.current[activeCueIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCueIndex]);

  const saveProgress = useCallback(
    async (mod: VideoModule, position: number, completed: boolean) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const row = {
        user_id: uid,
        module_file: mod.file,
        last_position: Math.round(position * 10) / 10,
        last_chapter: chapterAt(position),
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from("tutorial_progress")
        .upsert(row, { onConflict: "user_id,module_file" });
      if (!error) {
        setProgress((p) => ({
          ...p,
          [mod.file]: {
            module_file: mod.file,
            last_position: row.last_position,
            last_chapter: row.last_chapter,
            completed: completed || p[mod.file]?.completed || false,
          },
        }));
      }
    },
    [chapterAt],
  );

  const openVideo = async (mod: VideoModule, restart = false) => {
    setLoading(mod.file);
    const { data: signed, error } = await supabase.storage
      .from("tutoriais")
      .createSignedUrl(mod.file, 60 * 60);
    setLoading(null);
    if (error || !signed?.signedUrl) {
      toast({ title: "Não foi possível abrir o vídeo", description: "Tente novamente em instantes.", variant: "destructive" });
      return;
    }
    const saved = progress[mod.file];
    const resumeAt =
      !restart && saved && !saved.completed && saved.last_position > 3 && saved.last_position < mod.seconds - 5
        ? saved.last_position
        : 0;
    lastSaved.current = 0;
    setCurrent(resumeAt);
    setActive({ mod, url: signed.signedUrl, resumeAt });
  };

  const closeVideo = () => {
    const v = videoRef.current;
    if (active && v && v.currentTime > 1) {
      saveProgress(active.mod, v.currentTime, v.duration ? v.currentTime >= v.duration - 1.5 : false);
    }
    setActive(null);
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t + 0.05;
    v.play().catch(() => undefined);
  };

  const completedCount = videoModules.filter((m) => progress[m.file]?.completed).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg font-semibold text-foreground">Demonstração do sistema</h2>
          </div>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {completedCount} de {videoModules.length} assistidos
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Vídeos curtos gravados no sistema real, com legendas, capítulos e transcrição. O sistema guarda de onde você parou.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videoModules.map((mod, i) => {
          const saved = progress[mod.file];
          const pct = saved?.completed
            ? 100
            : saved
              ? Math.min(100, Math.round((saved.last_position / mod.seconds) * 100))
              : 0;
          return (
            <li key={mod.file}>
              <button
                type="button"
                onClick={() => openVideo(mod)}
                className="group flex h-full w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-accent/60 hover:bg-accent/5"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  {loading === mod.file ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved?.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-lilac" />
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
                  {pct > 0 && (
                    <span className="mt-2 block">
                      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", saved?.completed ? "bg-lilac" : "bg-accent")}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {saved?.completed
                          ? "Concluído"
                          : `Retomar em ${fmt(saved?.last_position ?? 0)}${saved?.last_chapter ? ` · ${saved.last_chapter}` : ""}`}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!active} onOpenChange={(o) => !o && closeVideo()}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{active?.mod.title}</DialogTitle>
          </DialogHeader>

          {active && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
              <div className="space-y-3">
                <video
                  key={active.url}
                  ref={videoRef}
                  src={active.url}
                  controls
                  autoPlay
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full rounded-xl bg-black"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (active.resumeAt > 0) v.currentTime = active.resumeAt;
                    const track = v.textTracks?.[0];
                    if (track) track.mode = "hidden";
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    setCurrent(v.currentTime);
                    if (v.currentTime - lastSaved.current > 5) {
                      lastSaved.current = v.currentTime;
                      saveProgress(active.mod, v.currentTime, false);
                    }
                  }}
                  onEnded={() => saveProgress(active.mod, active.mod.seconds, true)}
                  onPause={(e) => {
                    const v = e.currentTarget;
                    if (v.currentTime > 1) saveProgress(active.mod, v.currentTime, false);
                  }}
                >
                  {vttUrl && (
                    <track kind="captions" srcLang="pt-BR" label="Português" src={vttUrl} />
                  )}
                </video>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Captions className="h-3.5 w-3.5" /> Legendas ativadas
                  </span>
                  <button
                    type="button"
                    onClick={() => seekTo(0)}
                    className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-muted"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Recomeçar
                  </button>
                </div>

                {chapters.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <ListVideo className="h-3.5 w-3.5" /> Capítulos
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {chapters.map((ch, idx) => {
                        const next = chapters[idx + 1]?.t ?? Infinity;
                        const isActive = current >= ch.t && current < next;
                        return (
                          <li key={ch.t}>
                            <button
                              type="button"
                              onClick={() => seekTo(ch.t)}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                                isActive
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-border text-foreground hover:bg-muted",
                              )}
                            >
                              <span className="font-mono text-[11px] opacity-70">{fmt(ch.t)}</span>
                              {ch.title}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Transcrição
                </p>
                <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-border p-2 lg:max-h-[460px]">
                  {cues.map((c, idx) => (
                    <button
                      key={`${c.s}-${idx}`}
                      type="button"
                      ref={(el) => { cueRefs.current[idx] = el; }}
                      onClick={() => seekTo(c.s)}
                      className={cn(
                        "flex w-full gap-2 rounded-lg p-2 text-left text-xs transition-colors",
                        idx === activeCueIndex ? "bg-accent/10 text-foreground" : "hover:bg-muted text-muted-foreground",
                      )}
                    >
                      <span className="shrink-0 font-mono text-[11px] text-accent">{fmt(c.s)}</span>
                      <span className="min-w-0">{c.text}</span>
                    </button>
                  ))}
                  {cues.length === 0 && (
                    <p className="p-2 text-xs text-muted-foreground">Transcrição indisponível para este módulo.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VideoTutorials;
