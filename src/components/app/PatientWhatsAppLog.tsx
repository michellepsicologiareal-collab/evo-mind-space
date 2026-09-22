import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, MessageCircle, DollarSign, Brain, CalendarCheck, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatWhatsAppDisplay } from "@/utils/phoneFormat";
import { whatsappMessageTypeLabel } from "@/lib/whatsappLog";

interface Props {
  patientId: string;
  limit?: number;
}

interface LogRow {
  id: string;
  message_type: string;
  phone: string | null;
  detail: string | null;
  channel: string;
  sent_at: string;
}

const typeIcon: Record<string, React.ReactNode> = {
  billing: <DollarSign className="h-3.5 w-3.5" />,
  rpd: <Brain className="h-3.5 w-3.5" />,
  confirmation: <CalendarCheck className="h-3.5 w-3.5" />,
};

const typeColor: Record<string, string> = {
  billing: "bg-emerald-50 text-emerald-700",
  rpd: "bg-sky-50 text-sky-700",
  confirmation: "bg-amber-50 text-amber-800",
};

export default function PatientWhatsAppLog({ patientId, limit = 50 }: Props) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("whatsapp_message_logs")
        .select("id, message_type, phone, detail, channel, sent_at")
        .eq("patient_id", patientId)
        .order("sent_at", { ascending: false })
        .limit(limit);
      if (active) {
        setRows((data as LogRow[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patientId, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma mensagem enviada ainda. Cobranças, links de RPD e confirmações aparecem aqui assim que você enviar.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                typeColor[r.message_type] || "bg-muted text-muted-foreground"
              }`}
            >
              {typeIcon[r.message_type] || <MessageCircle className="h-3.5 w-3.5" />}
              {whatsappMessageTypeLabel[r.message_type] || "Mensagem"}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(r.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {r.channel === "clipboard" && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Copy className="h-3 w-3" /> copiada
              </span>
            )}
          </div>
          <p className="mt-1 text-sm">
            {r.phone ? formatWhatsAppDisplay(r.phone) : "Sem telefone cadastrado"}
          </p>
          {r.detail && <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>}
        </div>
      ))}
    </div>
  );
}
