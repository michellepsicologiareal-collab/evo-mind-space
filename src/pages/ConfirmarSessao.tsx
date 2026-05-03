import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Loader2, CalendarCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionData {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  patient_name: string;
}

type PageState = "loading" | "ready" | "confirmed" | "cancelled" | "already" | "error";

const ConfirmarSessao = () => {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    const load = async () => {
      const { data, error } = await supabase.rpc("get_session_by_token", { _token: token });
      if (error || !data || (data as any[]).length === 0) {
        setState("error");
        return;
      }
      const row = (data as any[])[0];
      setSession(row);
      if (row.status === "confirmed") setState("already");
      else if (row.status !== "scheduled") setState("already");
      else setState("ready");
    };
    load();
  }, [token]);

  const respond = async (confirm: boolean) => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("respond_to_confirmation", {
      _token: token,
      _confirm: confirm,
    });
    setSubmitting(false);
    if (error) { setState("error"); return; }
    if (data === "already_responded") { setState("already"); return; }
    setState(confirm ? "confirmed" : "cancelled");
  };

  const firstName = session?.patient_name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2">
          <Heart className="h-7 w-7 text-accent fill-accent/20" />
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

        {state === "ready" && session && (
          <>
            <CalendarCheck className="h-12 w-12 mx-auto text-accent mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Olá, {firstName}!
            </h1>
            <p className="mt-3 text-muted-foreground text-base">
              Você confirma sua sessão para
            </p>
            <p className="mt-2 font-display text-xl font-semibold text-foreground capitalize">
              {format(new Date(session.scheduled_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-lg text-accent font-semibold">
              às {format(new Date(session.scheduled_at), "HH:mm")}?
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

        {state === "confirmed" && (
          <div className="py-8">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Obrigado!</h2>
            <p className="mt-2 text-muted-foreground">Sessão confirmada com sucesso. Nos vemos em breve! 💚</p>
          </div>
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
