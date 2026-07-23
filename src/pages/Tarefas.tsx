import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, FileText, Printer, X, CheckSquare, NotebookPen, ListChecks, Eye, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeActions } from "@/components/app/PatientHomework";
import logoImg from "@/assets/logo-psireal.png";

interface Row {
  patient_name: string;
  therapist_name: string;
  therapist_crp: string | null;
  task_id: string | null;
  title: string | null;
  content: string | null;
  session_points: string | null;
  actions: Json | null;
  weekly_observations: string | null;
  sent_at: string | null;
  created_at: string | null;
}

const Tarefas = () => {
  const { token } = useParams<{ token: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "password" | "ready" | "error">("loading");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Plano entre Sessões — Psi Real";
    return () => { document.title = "Psi Real — Gestão Inteligente para Psicólogos"; };
  }, []);

  const loadRows = async (pwd: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc("get_homework_by_token", { _token: token as string, _password: pwd });
    if (error) return false;
    const list = (data as Row[]) ?? [];
    if (list.length === 0) return false;
    setRows(list);
    setState("ready");
    return true;
  };

  useEffect(() => {
    if (!token) { setState("error"); return; }
    (async () => {
      const { data: info, error: infoErr } = await supabase.rpc("get_homework_link_info", { _token: token });
      if (infoErr || !info || (info as any[]).length === 0) { setState("error"); return; }
      const meta = (info as any[])[0];
      if (meta.password_required) {
        setState("password");
      } else {
        const ok = await loadRows("");
        if (!ok) setState("error");
      }
    })();
  }, [token]);

  // Scroll para o plano específico quando #plano-<id> estiver na URL
  useEffect(() => {
    if (state !== "ready") return;
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-accent", "rounded-xl");
        setTimeout(() => el.classList.remove("ring-2", "ring-accent", "rounded-xl"), 2500);
      }, 150);
    }
  }, [state]);


  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setChecking(true);
    setPwdError(null);
    const ok = await loadRows(password);
    setChecking(false);
    if (!ok) setPwdError("Senha incorreta. Verifique com sua psicóloga.");
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (state === "password") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <form
          onSubmit={submitPassword}
          className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 space-y-4"
        >
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-lilac/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-lilac" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mt-3">Link protegido</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Digite a senha enviada pela sua psicóloga para acessar seu Plano entre Sessões.
            </p>
          </div>
          <div className="space-y-1">
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              maxLength={60}
            />
            {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
          </div>
          <Button type="submit" variant="accent" className="w-full" disabled={checking || !password.trim()}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar"}
          </Button>
        </form>
      </div>
    );
  }

  if (state === "error" || rows.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl bg-card border border-border p-8">
          <X className="h-12 w-12 mx-auto text-destructive/40 mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground">Link inválido</h2>
          <p className="mt-2 text-muted-foreground">Esta página de planos não está disponível.</p>
        </div>
      </div>
    );
  }

  const header = rows[0];
  const tasks = rows.filter((r) => r.task_id);

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto p-6 print:p-0">
        <div className="flex items-center justify-between gap-3 mb-6 no-print">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Psi Real" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg font-bold text-foreground">Psi Real</span>
          </div>
          <Button variant="accent" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Baixar/Imprimir PDF
          </Button>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6 sm:p-8 print:border-0 print:p-4">
          <div className="border-b border-border pb-4 mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">Plano entre Sessões</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{header.patient_name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Psicóloga: {header.therapist_name}{header.therapist_crp ? ` · CRP ${header.therapist_crp}` : ""}
            </p>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhum plano enviado ainda.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {tasks.map((t, i) => {
                const taskActions = normalizeActions(t.actions);
                return (
                  <div key={t.task_id!} id={`plano-${t.task_id}`} className="pb-6 border-b border-border last:border-0 last:pb-0 break-inside-avoid scroll-mt-6 target:ring-2 target:ring-accent target:rounded-xl">

                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <h2 className="font-display text-base font-semibold text-foreground">
                        {i + 1}. {t.title}
                      </h2>
                      {t.sent_at && (
                        <span className="text-[11px] text-muted-foreground">
                          Enviado em {format(new Date(t.sent_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {t.session_points && (
                      <div className="mt-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <NotebookPen className="h-3.5 w-3.5" /> Pontos importantes da sessão
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{t.session_points}</p>
                      </div>
                    )}

                    {taskActions.length > 0 && (
                      <div className="mt-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <ListChecks className="h-3.5 w-3.5" /> Plano entre Sessões
                        </p>
                        <ul className="space-y-1">
                          {taskActions.map((a: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                              <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                              <span className="leading-relaxed">{typeof a === "string" ? a : (a?.text || "")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {t.weekly_observations && (
                      <div className="mt-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <Eye className="h-3.5 w-3.5" /> O que observar durante a semana
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{t.weekly_observations}</p>
                      </div>
                    )}

                    {!t.session_points && taskActions.length === 0 && !t.weekly_observations && t.content && (
                      <p className="mt-3 text-sm text-foreground whitespace-pre-line leading-relaxed">{t.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-8 pt-4 border-t border-border text-[10px] text-muted-foreground text-center">
            Documento gerado pelo Psi Real
          </p>
        </div>
      </div>
    </div>
  );
};

export default Tarefas;
