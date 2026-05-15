import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, FileText, AlertTriangle, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Props {
  patientId: string;
  patientName?: string;
}

interface RecordRow {
  id: string;
  session_date: string;
  session_number: number | null;
  modality: string;
  duration_minutes: number;
  chief_complaint: string | null;
  themes: string[] | null;
  clinical_observations: string | null;
  next_session_plan: string | null;
  engagement: number | null;
  risk_indicator: string;
  private_notes: string | null;
  created_at: string;
}

const RISK_LABEL: Record<string, string> = {
  none: "Sem risco",
  low: "Risco baixo",
  moderate: "Risco moderado",
  high: "Risco alto",
};

const RISK_COLOR: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  low: "bg-amber-50 text-amber-700",
  moderate: "bg-orange-100 text-orange-700",
  high: "bg-destructive/15 text-destructive",
};

export const PatientSessionRecords = ({ patientId }: Props) => {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("session_records")
        .select("*")
        .eq("patient_id", patientId)
        .order("session_date", { ascending: false });
      setRecords((data as RecordRow[]) ?? []);
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum registro de sessão ainda.</p>
        </div>
        <div className="flex justify-center">
          <Button asChild variant="accent" size="sm">
            <Link to={`/app/registro-sessao?patient=${patientId}`}>
              <Pencil className="h-3.5 w-3.5" /> Criar primeiro registro
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="accent" size="sm" className="gap-1.5 text-xs">
          <Link to={`/app/registro-sessao?patient=${patientId}`}>
            <Pencil className="h-3.5 w-3.5" /> Novo registro
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {records.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-display font-semibold text-foreground">
                  {format(new Date(r.session_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  {r.session_number != null && (
                    <span className="ml-2 text-xs text-muted-foreground">Sessão #{r.session_number}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {r.modality} · {r.duration_minutes} min
                  {r.engagement != null && ` · Engajamento ${r.engagement}/5`}
                </p>
              </div>
              {r.risk_indicator && r.risk_indicator !== "none" && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${RISK_COLOR[r.risk_indicator] ?? ""}`}
                >
                  <AlertTriangle className="h-3 w-3" /> {RISK_LABEL[r.risk_indicator] ?? r.risk_indicator}
                </span>
              )}
            </div>

            {r.themes && r.themes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.themes.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/40 text-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {r.chief_complaint && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Queixa principal</p>
                <p className="text-sm text-foreground whitespace-pre-line">{r.chief_complaint}</p>
              </div>
            )}

            {r.clinical_observations && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Observações clínicas</p>
                <p className="text-sm text-foreground whitespace-pre-line">{r.clinical_observations}</p>
              </div>
            )}

            {r.next_session_plan && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Plano para próxima sessão</p>
                <p className="text-sm text-foreground whitespace-pre-line">{r.next_session_plan}</p>
              </div>
            )}

            {r.private_notes && (
              <div className="rounded-lg bg-background p-2 border border-border/60">
                <p className="text-[10px] uppercase text-muted-foreground">Notas privadas</p>
                <p className="text-sm text-foreground whitespace-pre-line">{r.private_notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
