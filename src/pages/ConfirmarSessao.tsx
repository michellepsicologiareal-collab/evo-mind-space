import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Check, X, Loader2, CalendarCheck, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type PageState = "loading" | "ready" | "confirmed" | "cancelled" | "already" | "error";

function buildICS(session: SessionData): string {
  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + session.duration_minutes * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const therapist = session.therapist_name || "Psicóloga";
  const mod = session.modality ? ` (${session.modality})` : "";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PsiReal//PT",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Sessão com ${therapist}${mod}`,
    `DESCRIPTION:Sessão de psicologia com ${therapist}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function googleCalUrl(session: SessionData): string {
  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + session.duration_minutes * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const therapist = session.therapist_name || "Psicóloga";
  const mod = session.modality ? ` (${session.modality})` : "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Sessão com ${therapist}${mod}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Sessão de psicologia com ${therapist}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const ConfirmarSessao = () => {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Confirmação de Sessão — Psi Real";
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(property.startsWith("og:") ? "property" : "name", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const baseUrl = window.location.origin;
    setMeta("og:title", "Confirmação de Sessão — Psi Real");
    setMeta("og:description", "Clique para confirmar sua sessão");
    setMeta("og:image", `${baseUrl}/logo-psireal.png`);
    setMeta("og:type", "website");
    setMeta("twitter:title", "Confirmação de Sessão — Psi Real");
    setMeta("twitter:description", "Clique para confirmar sua sessão");
    setMeta("twitter:image", `${baseUrl}/logo-psireal.png`);
    return () => { document.title = "Psi Real — Gestão Inteligente para Psicólogos"; };
  }, []);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    const load = async () => {
      const { data, error } = await supabase.rpc("get_session_by_token", { _token: token });
      if (error || !data || (data as any[]).length === 0) { setState("error"); return; }
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
    const { data, error } = await supabase.rpc("respond_to_confirmation", { _token: token, _confirm: confirm });
    setSubmitting(false);
    if (error) { setState("error"); return; }
    if (data === "already_responded") { setState("already"); return; }
    setState(confirm ? "confirmed" : "cancelled");
  };

  const downloadICS = () => {
    if (!session) return;
    const blob = new Blob([buildICS(session)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sessao-psireal.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const firstName = session?.patient_name?.split(" ")[0] ?? "";
  const zonedDate = session ? toZonedTime(new Date(session.scheduled_at), "America/Sao_Paulo") : null;

  const SessionDetails = () => {
    if (!session || !zonedDate) return null;
    return (
      <div className="mt-4 rounded-xl bg-muted/40 p-4 text-left space-y-1.5">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">📅 Data:</span>{" "}
          <span className="capitalize">{format(zonedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">🕐 Horário:</span>{" "}
          {format(zonedDate, "HH:mm")}
        </p>
        {session.therapist_name && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">👩‍⚕️ Terapeuta:</span>{" "}
            {session.therapist_name}
          </p>
        )}
        {session.modality && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">📍 Modalidade:</span>{" "}
            {session.modality}
          </p>
        )}
      </div>
    );
  };

  const CalendarButtons = () => {
    if (!session) return null;
    return (
      <div className="mt-5 flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => window.open(googleCalUrl(session), "_blank")}
        >
          <Calendar className="h-4 w-4 text-accent" />
          Adicionar ao Google Agenda
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={downloadICS}
        >
          <Calendar className="h-4 w-4 text-accent" />
          Adicionar ao Apple Calendar
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm"
          onClick={downloadICS}
        >
          <Download className="h-4 w-4" />
          Baixar lembrete (.ics)
        </Button>
      </div>
    );
  };

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
            <p className="mt-2 font-display text-xl font-semibold text-foreground capitalize">
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

        {state === "confirmed" && session && (
          <div className="py-6">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Obrigado!</h2>
            <p className="mt-2 text-muted-foreground">Sessão confirmada com sucesso. Nos vemos em breve! 💚</p>

            <SessionDetails />
            <CalendarButtons />
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
