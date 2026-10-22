import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Check, X, Loader2, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFreshPublicPage } from "@/hooks/useFreshPublicPage";
import { fetchSessionByToken } from "@/lib/publicSessionToken";
import { toast } from "sonner";
import logoImg from "@/assets/logo-psireal.png";

interface SessionData {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  patient_name: string;
  modality: string | null;
  therapist_name: string | null;
}

type PageState = "loading" | "ready" | "cancelled" | "already" | "error" | "network";

const ConfirmarSessao = () => {
  useFreshPublicPage();
  const { token: rawToken } = useParams<{ token: string }>();
  const token = expandToken(rawToken);
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    document.title = "Confirmação de Sessão — Psi Real";
    return () => { document.title = "Psi Real — Gestão Inteligente para Psicólogos"; };
  }, []);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    let alive = true;
    setState("loading");
    const load = async () => {
      const res = await fetchSessionByToken(token);
      if (!alive) return;
      if (res.kind === "network") { setState("network"); return; }
      if (res.kind === "not_found") { setState("error"); return; }
      const row = res.row;
      setSession(row);
      if (row.status === "confirmed") {
        navigate(`/sessao-confirmada/${token}`, { replace: true });
      } else if (row.status !== "scheduled") {
        setState("already");
      } else {
        setState("ready");
      }
    };
    load();
    return () => { alive = false; };
  }, [token, navigate, reloadKey]);

  const respond = async (confirm: boolean) => {
    if (!token) return;
    setSubmitting(true);
    let result: { data: any; error: any } = { data: null, error: null };
    for (let i = 0; i < 3; i++) {
      try {
        result = await supabase.rpc("respond_to_confirmation", { _token: token, _confirm: confirm });
        if (!result.error) break;
      } catch (e) {
        result = { data: null, error: e };
      }
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
    setSubmitting(false);
    const { data, error } = result;
    if (error) {
      toast.error("Sem conexão no momento. Verifique a internet e toque em “Sim, confirmo” novamente.");
      return;
    }
    if (data === "already_responded") { setState("already"); return; }
    if (confirm) {
      navigate(`/sessao-confirmada/${token}`, { replace: true });
    } else {
      setState("cancelled");
    }
  };

  const firstName = session?.patient_name?.split(" ")[0] ?? "";
  const zonedDate = session ? toZonedTime(new Date(session.scheduled_at), "America/Sao_Paulo") : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2">
          <img src={logoImg} alt="Psi Real" className="h-10 w-10 object-contain" />
          <span className="font-display text-2xl font-bold text-foreground">Psi Real</span>
        </div>
      </div>

      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-card p-8 text-center">
        {state === "loading" && (
          <div className="py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        )}

        {state === "ready" && session && zonedDate && (
          <>
            <CalendarCheck className="h-12 w-12 mx-auto text-accent mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Olá, {firstName}!
            </h1>
            <p className="mt-3 text-muted-foreground text-base">
              Você confirma sua sessão para
            </p>
            <p className="mt-2 font-display text-xl font-semibold text-foreground first-letter:uppercase">
              {format(zonedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-lg text-accent font-semibold">
              às {format(zonedDate, "HH:mm")}?
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Button
                variant="accent"
                className="min-h-[52px] text-base font-semibold w-full"
                disabled={submitting}
                onClick={() => respond(true)}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Sim, confirmo
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Precisa cancelar? Entre em contato diretamente com sua psicóloga.
              </p>
            </div>
          </>
        )}

        {state === "cancelled" && (
          <div className="py-8">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Tudo bem!</h2>
            <p className="mt-2 text-muted-foreground">Sua psicóloga foi notificada. Esperamos te ver em breve. 🤗</p>
          </div>
        )}

        {state === "already" && (
          <div className="py-8">
            <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="font-display text-xl font-bold text-foreground">Sessão já respondida</h2>
            <p className="mt-2 text-muted-foreground">Esta confirmação já foi processada anteriormente.</p>
          </div>
        )}

        {state === "network" && (
          <div className="py-8">
            <Loader2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="font-display text-xl font-bold text-foreground">Conexão instável</h2>
            <p className="mt-2 text-muted-foreground">Não conseguimos carregar sua sessão agora. Seu link continua válido.</p>
            <Button variant="accent" className="mt-6 min-h-[48px] w-full" onClick={() => setReloadKey((k) => k + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="py-8">
            <X className="h-12 w-12 mx-auto text-destructive/40 mb-4" />
            <h2 className="font-display text-xl font-bold text-foreground">Link inválido</h2>
            <p className="mt-2 text-muted-foreground">Este link de confirmação não é válido ou já expirou.</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Psi Real — Gestão Clínica para Psicólogas</p>
    </div>
  );
};

export default ConfirmarSessao;
