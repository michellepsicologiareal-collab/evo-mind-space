import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Check, Loader2, Download, Calendar, Smartphone, Copy } from "lucide-react";
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
  meeting_link?: string | null;
  clinic_address?: string | null;
  pix_key?: string | null;
}

function buildICS(session: SessionData): string {
  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + session.duration_minutes * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const therapist = session.therapist_name || "Psicóloga";
  const mod = session.modality ? ` (${session.modality})` : "";
  const place = session.meeting_link || session.clinic_address || "";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PsiReal//PT",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Sessão com ${therapist}${mod}`,
    ...(place ? [`LOCATION:${place}`] : []),
    `DESCRIPTION:Sessão de psicologia com ${therapist}${place ? ` — ${place}` : ""}`,
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
  const place = session.meeting_link || session.clinic_address || "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Sessão com ${therapist}${mod}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Sessão de psicologia com ${therapist}${place ? ` — ${place}` : ""}`,
    ...(place ? { location: place } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const SessaoConfirmada = () => {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const copyPix = async () => {
    if (!session?.pix_key) return;
    try {
      await navigator.clipboard.writeText(session.pix_key);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2500);
    } catch {
      // clipboard indisponível — o paciente ainda vê a chave na tela
    }
  };

  useEffect(() => {
    document.title = "Sessão Confirmada — Psi Real";
    return () => { document.title = "Psi Real — Gestão Inteligente para Psicólogos"; };
  }, []);

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return; }
    const load = async () => {
      const { data, error: err } = await supabase.rpc("get_session_by_token", { _token: token });
      if (err || !data || (data as any[]).length === 0) { setError(true); setLoading(false); return; }
      setSession((data as any[])[0]);
      setLoading(false);
    };
    load();
  }, [token]);

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
        {loading && (
          <div className="py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        )}

        {error && (
          <div className="py-8">
            <p className="text-muted-foreground">Link inválido ou expirado.</p>
          </div>
        )}

        {!loading && !error && session && zonedDate && (
          <div className="py-6">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Sessão Confirmada!</h2>
            <p className="mt-2 text-muted-foreground">Obrigado por confirmar. Nos vemos em breve! 💚</p>

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
              {session.meeting_link && (
                <p className="text-sm text-muted-foreground break-all">
                  <span className="font-medium text-foreground">💻 Link da videochamada:</span>{" "}
                  <a
                    href={session.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline font-medium"
                  >
                    {session.meeting_link}
                  </a>
                </p>
              )}
              {!session.meeting_link && session.clinic_address && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">🏠 Endereço:</span>{" "}
                  {session.clinic_address}
                </p>
              )}
            </div>

            {session.pix_key && (
              <div className="mt-3 rounded-xl bg-muted/40 border border-border p-4 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-foreground">Pagamento via PIX</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Chave PIX de {session.therapist_name?.split(" ")[0] ?? "sua psicóloga"}:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-foreground bg-background rounded-lg px-3 py-2 border border-border break-all select-all">
                    {session.pix_key}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={copyPix}
                  >
                    {pixCopied ? <Check className="h-4 w-4 text-moss" /> : <Copy className="h-4 w-4" />}
                    {pixCopied ? "Copiada!" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}

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
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Psi Real — Gestão Clínica para Psicólogas</p>
    </div>
  );
};

export default SessaoConfirmada;
