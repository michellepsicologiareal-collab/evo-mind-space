import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, Pencil, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  anamnesisId: string;
  onSaved?: () => void;
}

type AnamnesisRow = {
  id: string;
  patient_id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  profession: string | null;
  marital_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  reason_for_seeking: string | null;
  problem_duration: string | null;
  impact_level: number | null;
  symptoms: string[] | null;
  symptom_other: string | null;
  uses_medication: string | null;
  medication_name: string | null;
  had_psychotherapy: string | null;
  had_psychiatrist: string | null;
  scale_sleep: number | null;
  scale_feeding: number | null;
  scale_work: number | null;
  scale_relationships: number | null;
  scale_leisure: number | null;
  scale_physical_health: number | null;
  support_network: string | null;
  support_network_details: string | null;
  important_events: string | null;
  therapy_goals: string | null;
  additional_info: string | null;
  risk_ideation: string;
  risk_flag: boolean;
  status: string;
  submitted_at: string;
};

const DURATION_LABEL: Record<string, string> = {
  "<1m": "Menos de 1 mês",
  "1_6m": "1 a 6 meses",
  "6_12m": "6 meses a 1 ano",
  ">1y": "Mais de 1 ano",
};
const YN: Record<string, string> = { yes: "Sim", no: "Não", never: "Nunca", sometimes: "Às vezes" };
const RISK_LABEL: Record<string, string> = {
  none: "Não",
  sometimes: "Algumas vezes",
  frequent: "Frequentemente",
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground/90 whitespace-pre-wrap">{value || "—"}</span>
  </div>
);

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-background/50 p-4 space-y-2">
    <h4 className="font-display text-base font-semibold">{title}</h4>
    {children}
  </section>
);

export const AdultAnamnesisViewer = ({ anamnesisId, onSaved }: Props) => {
  const [row, setRow] = useState<AnamnesisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("adult_anamneses")
      .select("*")
      .eq("id", anamnesisId)
      .maybeSingle();
    if (error) toast.error("Erro ao carregar anamnese");
    setRow(data as unknown as AnamnesisRow);
    setLoading(false);
  };

  useEffect(() => { load(); }, [anamnesisId]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { id, submitted_at, risk_flag, ...update } = row as any;
    const { error } = await supabase.from("adult_anamneses").update(update).eq("id", anamnesisId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Anamnese atualizada");
    setEditing(false);
    onSaved?.();
  };

  const exportPdf = () => {
    if (!row) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const w = doc.internal.pageSize.getWidth() - margin * 2;
    let y = margin;

    const line = (t: string, size = 11, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const wrapped = doc.splitTextToSize(t, w);
      for (const w1 of wrapped) {
        if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.text(w1, margin, y);
        y += size + 4;
      }
    };
    const gap = (n = 6) => { y += n; };
    const kv = (k: string, v?: string | number | null) => line(`${k}: ${v ?? "—"}`);

    line("Anamnese Inicial — Adulto", 16, true);
    gap(4);
    line(row.full_name, 13, true);
    line(`Enviada em ${format(new Date(row.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 10);
    gap();

    line("1. Dados pessoais", 12, true);
    kv("Nascimento", row.birth_date);
    kv("Telefone", row.phone);
    kv("E-mail", row.email);
    kv("Profissão", row.profession);
    kv("Estado civil", row.marital_status);
    kv("Contato de emergência", row.emergency_contact_name);
    kv("Telefone contato", row.emergency_contact_phone);
    gap();

    line("2. Motivo da procura", 12, true);
    line(row.reason_for_seeking || "—");
    gap();

    line("3. Tempo do problema", 12, true);
    line(DURATION_LABEL[row.problem_duration || ""] || "—");
    gap();

    line("4. Impacto (0-10)", 12, true);
    line(String(row.impact_level ?? "—"));
    gap();

    line("5. Sintomas", 12, true);
    line((row.symptoms || []).join(", ") || "—");
    if (row.symptom_other) line(`Outro: ${row.symptom_other}`);
    gap();

    line("6. Tratamentos anteriores", 12, true);
    kv("Medicação", YN[row.uses_medication || ""] || "—");
    if (row.medication_name) kv("Medicamento", row.medication_name);
    kv("Psicoterapia anterior", YN[row.had_psychotherapy || ""] || "—");
    kv("Psiquiatra", YN[row.had_psychiatrist || ""] || "—");
    gap();

    line("7. Vida hoje (0-10)", 12, true);
    kv("Sono", row.scale_sleep);
    kv("Alimentação", row.scale_feeding);
    kv("Trabalho/Estudos", row.scale_work);
    kv("Relacionamentos", row.scale_relationships);
    kv("Lazer", row.scale_leisure);
    kv("Saúde física", row.scale_physical_health);
    gap();

    line("8. Rede de apoio", 12, true);
    kv("Tem rede", YN[row.support_network || ""] || "—");
    if (row.support_network_details) line(row.support_network_details);
    gap();

    line("9. Eventos importantes", 12, true);
    line(row.important_events || "—");
    gap();

    line("10. Objetivos", 12, true);
    line(row.therapy_goals || "—");
    gap();

    line("11. Informações adicionais", 12, true);
    line(row.additional_info || "—");
    gap();

    line("12. Segurança (ideação)", 12, true);
    line(RISK_LABEL[row.risk_ideation] || "—", 11, row.risk_flag);
    gap(10);

    line("Documento gerado pelo Psi Real — uso clínico exclusivo.", 9);
    doc.save(`anamnese-adulto-${row.full_name.replace(/\s+/g, "_")}.pdf`);
  };

  if (loading || !row) {
    return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const update = <K extends keyof AnamnesisRow>(k: K, v: AnamnesisRow[K]) => setRow((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Status: {row.status}</span>
          {row.risk_flag && (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Ideação sinalizada
            </span>
          )}
          <span>Enviada em {format(new Date(row.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          {editing ? (
            <Button variant="accent" size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </div>
      </div>

      <Block title="1. Dados pessoais">
        {editing ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Nome</Label><Input value={row.full_name} onChange={(e) => update("full_name", e.target.value)} /></div>
            <div><Label className="text-xs">Nascimento</Label><Input type="date" value={row.birth_date ?? ""} onChange={(e) => update("birth_date", e.target.value)} /></div>
            <div><Label className="text-xs">Telefone</Label><Input value={row.phone ?? ""} onChange={(e) => update("phone", e.target.value)} /></div>
            <div><Label className="text-xs">E-mail</Label><Input value={row.email ?? ""} onChange={(e) => update("email", e.target.value)} /></div>
            <div><Label className="text-xs">Profissão</Label><Input value={row.profession ?? ""} onChange={(e) => update("profession", e.target.value)} /></div>
            <div><Label className="text-xs">Estado civil</Label><Input value={row.marital_status ?? ""} onChange={(e) => update("marital_status", e.target.value)} /></div>
            <div><Label className="text-xs">Contato emergência</Label><Input value={row.emergency_contact_name ?? ""} onChange={(e) => update("emergency_contact_name", e.target.value)} /></div>
            <div><Label className="text-xs">Telefone contato</Label><Input value={row.emergency_contact_phone ?? ""} onChange={(e) => update("emergency_contact_phone", e.target.value)} /></div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Row label="Nome" value={row.full_name} />
            <Row label="Nascimento" value={row.birth_date} />
            <Row label="Telefone" value={row.phone} />
            <Row label="E-mail" value={row.email} />
            <Row label="Profissão" value={row.profession} />
            <Row label="Estado civil" value={row.marital_status} />
            <Row label="Emergência" value={`${row.emergency_contact_name ?? "—"} ${row.emergency_contact_phone ? `(${row.emergency_contact_phone})` : ""}`} />
          </div>
        )}
      </Block>

      <Block title="2. Motivo da procura">
        {editing
          ? <Textarea rows={4} value={row.reason_for_seeking ?? ""} onChange={(e) => update("reason_for_seeking", e.target.value)} />
          : <p className="text-sm whitespace-pre-wrap">{row.reason_for_seeking || "—"}</p>}
      </Block>

      <Block title="3. Tempo do problema">
        <p className="text-sm">{DURATION_LABEL[row.problem_duration || ""] || "—"}</p>
      </Block>

      <Block title="4. Impacto na vida (0-10)">
        <p className="font-display text-3xl font-semibold text-primary">{row.impact_level ?? "—"}</p>
      </Block>

      <Block title="5. Sintomas">
        <div className="flex flex-wrap gap-1.5">
          {(row.symptoms || []).map((s) => (
            <span key={s} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{s}</span>
          ))}
          {(!row.symptoms || row.symptoms.length === 0) && <p className="text-sm text-muted-foreground">—</p>}
        </div>
        {row.symptom_other && <p className="text-sm mt-2"><span className="text-muted-foreground">Outro:</span> {row.symptom_other}</p>}
      </Block>

      <Block title="6. Tratamentos anteriores">
        <Row label="Medicação" value={YN[row.uses_medication || ""] || "—"} />
        {row.uses_medication === "yes" && <Row label="Medicamento" value={row.medication_name} />}
        <Row label="Psicoterapia" value={YN[row.had_psychotherapy || ""] || "—"} />
        <Row label="Psiquiatra" value={YN[row.had_psychiatrist || ""] || "—"} />
      </Block>

      <Block title="7. Como está sua vida hoje (0-10)">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["Sono", row.scale_sleep], ["Alimentação", row.scale_feeding],
            ["Trabalho", row.scale_work], ["Relacionamentos", row.scale_relationships],
            ["Lazer", row.scale_leisure], ["Saúde física", row.scale_physical_health],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-background border border-border p-2 text-center">
              <p className="text-[11px] text-muted-foreground">{l as string}</p>
              <p className="font-display text-xl font-semibold text-primary">{(v as number) ?? "—"}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="8. Rede de apoio">
        <Row label="Tem rede" value={YN[row.support_network || ""] || "—"} />
        {row.support_network_details && <p className="text-sm mt-1 whitespace-pre-wrap">{row.support_network_details}</p>}
      </Block>

      <Block title="9. Eventos importantes">
        {editing
          ? <Textarea rows={3} value={row.important_events ?? ""} onChange={(e) => update("important_events", e.target.value)} />
          : <p className="text-sm whitespace-pre-wrap">{row.important_events || "—"}</p>}
      </Block>

      <Block title="10. Objetivos">
        {editing
          ? <Textarea rows={3} value={row.therapy_goals ?? ""} onChange={(e) => update("therapy_goals", e.target.value)} />
          : <p className="text-sm whitespace-pre-wrap">{row.therapy_goals || "—"}</p>}
      </Block>

      <Block title="11. Informações adicionais">
        {editing
          ? <Textarea rows={3} value={row.additional_info ?? ""} onChange={(e) => update("additional_info", e.target.value)} />
          : <p className="text-sm whitespace-pre-wrap">{row.additional_info || "—"}</p>}
      </Block>

      <Block title="12. Segurança">
        <p className={`text-sm font-medium ${row.risk_flag ? "text-destructive" : "text-foreground/80"}`}>
          {RISK_LABEL[row.risk_ideation] || "—"}
        </p>
        {row.risk_flag && (
          <p className="text-xs text-muted-foreground mt-1">
            Paciente sinalizou ideação. Considere abordar com cuidado na primeira sessão.
          </p>
        )}
      </Block>
    </div>
  );
};
