import { useEffect, useState } from "react";
import { format, differenceInDays, differenceInMonths, differenceInYears, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, ChevronRight, ChevronLeft, AlertTriangle, ChevronDown, ChevronUp, Calendar, Target, ClipboardList, Pencil, Save, Download, Maximize2, Minimize2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SessionTimeline } from "@/components/app/SessionTimeline";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type RecordSource = "legacy" | "v2";

interface UnifiedRecord {
  id: string;
  source: RecordSource;
  session_id: string | null;
  session_date: string; // ISO
  session_number: number | null;
  modality: string | null;
  duration_minutes: number | null;
  // conteúdo clínico (normalizado)
  chief_complaint: string | null; // legacy chief_complaint OU v2 patient_context (rótulo "Queixa/contexto")
  clinical_observations: string | null; // legacy clinical_observations OU v2 clinical_observation
  themes: string[] | null;
  emotions: string[] | null; // v2 apenas
  wellbeing_score: number | null; // v2 apenas
  engagement: number | null;
  attention_flag: string | null; // v2: none|watch|urgent; legacy: mapeado a partir de risk_indicator
  private_notes: string | null;
  // Combinado/tarefa — preparado para integração futura com session_plans
  next_session_plan: string | null; // legacy: session_records.next_session_plan; v2: sempre null por enquanto
  created_at: string;
}

const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Falta",
  rescheduled: "Remarcada",
};

const ATTENTION_LABEL: Record<string, string> = {
  watch: "Atenção",
  urgent: "Atenção urgente",
  // compat legacy
  low: "Risco baixo",
  moderate: "Risco moderado",
  high: "Risco alto",
};

// Mapeia risk_indicator (legacy) -> attention_flag equivalente para exibição unificada
const legacyRiskToAttention = (risk: string | null): string | null => {
  if (!risk || risk === "none") return null;
  if (risk === "low") return "low";
  if (risk === "moderate") return "watch";
  if (risk === "high") return "urgent";
  return risk;
};

interface Props {
  patientId: string;
  nextDate: Date | string | null | undefined;
  lastDate: Date | string | null | undefined;
  totalRecords: number;
  onOpenFullHistory: () => void;
  /** Chamado ao navegar para fora (ex.: fechar a Sheet na Agenda). */
  onNavigateAway?: () => void;
}

// Parse "YYYY-MM-DD" como data local (evita shift de timezone que joga 19/05 para 18/05).
// Datas com horário (ISO com T ou timezone) seguem o parser padrão.
const parseSessionDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
};

const fmtDate = (d: Date | string | null | undefined) => {
  const parsed = parseSessionDate(d);
  return parsed ? format(parsed, "dd/MM/yyyy", { locale: ptBR }) : "—";
};

const followUpLabel = (start: Date | null): string => {
  if (!start) return "—";
  const now = new Date();
  const days = differenceInDays(now, start);
  if (days < 0) return "—";
  if (days < 7) return days <= 1 ? "menos de 1 dia" : `${days} dias`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 semana" : `${weeks} semanas`;
  }
  const months = differenceInMonths(now, start);
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = differenceInYears(now, start);
  const remMonths = months - years * 12;
  if (remMonths === 0) return years === 1 ? "1 ano" : `${years} anos`;
  return `${years} ${years === 1 ? "ano" : "anos"} e ${remMonths} ${remMonths === 1 ? "mês" : "meses"}`;
};

const normalizeEmotions = (raw: unknown): string[] | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map((e) => (typeof e === "string" ? e : (e as any)?.label ?? String(e))).filter(Boolean);
  if (typeof raw === "object") {
    const arr = Object.values(raw as Record<string, unknown>);
    return arr.map((e) => (typeof e === "string" ? e : (e as any)?.label ?? String(e))).filter(Boolean);
  }
  return null;
};

const SummaryTile = ({ label, value }: { label: string; value: string }) => (
  <div
    className="rounded-xl p-3"
    style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
  >
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-display font-semibold text-foreground leading-tight">{value}</p>
  </div>
);

const SourceBadge = ({ source }: { source: RecordSource }) => (
  <span
    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
      source === "v2"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground"
    }`}
    title={source === "v2" ? "Registro do novo fluxo (Agenda → Editar sessão)" : "Registro legado (RegistroSessao)"}
  >
    {source === "v2" ? "v2" : "Legado"}
  </span>
);

export const PatientSessionsQuickView = ({
  patientId,
  nextDate,
  lastDate,
  totalRecords,
  onOpenFullHistory,
  onNavigateAway,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [recordsBySession, setRecordsBySession] = useState<Record<string, UnifiedRecord>>({});
  const [agenda, setAgenda] = useState<
    { id: string; scheduled_at: string; status: string; modality: string | null; duration_minutes: number | null }[]
  >([]);
  const [expandedSession, setExpandedSession] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<UnifiedRecord | null>(null);
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("upcoming");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalityFilter, setModalityFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editDraft, setEditDraft] = useState({ chief_complaint: "", clinical_observations: "", next_session_plan: "" });
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [exporting, setExporting] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const sessions = agenda
      .filter((s) => isSameDay(new Date(s.scheduled_at), day))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return { day, sessions };
  });

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { data: patient } = await supabase
        .from("patients")
        .select("full_name")
        .eq("id", patientId)
        .maybeSingle();
      const patientName = patient?.full_name ?? "Paciente";

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageW - margin * 2;
      let y = margin;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const writeBlock = (label: string, value: string) => {
        const lines = doc.splitTextToSize(value, contentWidth - 2) as string[];
        ensureSpace(6 + lines.length * 4.6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(110);
        doc.text(label, margin + 1, y);
        y += 4.4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text(lines, margin + 1, y);
        y += lines.length * 4.6 + 2;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(20);
      doc.text("Histórico de sessões", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(patientName, margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
      y += 8;

      const ordered = [...agenda].sort(
        (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );

      ordered.forEach((s) => {
        const rec = recordsBySession[s.id] ?? null;
        const dt = new Date(s.scheduled_at);
        ensureSpace(18);
        doc.setDrawColor(220);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(20);
        doc.text(format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), margin, y);
        y += 4.6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(110);
        const meta = [
          SESSION_STATUS_LABEL[s.status] ?? s.status,
          s.modality ? `Modalidade: ${s.modality}` : "Modalidade: não informada",
          s.duration_minutes != null ? `${s.duration_minutes} min` : null,
        ].filter(Boolean) as string[];
        doc.text(meta.join("  ·  "), margin, y);
        y += 5.5;

        if (!rec) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(140);
          doc.text("Sem registro escrito.", margin + 1, y);
          y += 7;
          return;
        }

        if (rec.chief_complaint) writeBlock("Queixa / contexto", rec.chief_complaint);
        if (rec.clinical_observations) writeBlock("Observação clínica", rec.clinical_observations);
        if (rec.themes && rec.themes.length > 0) writeBlock("Temas", rec.themes.filter(Boolean).join(", "));
        if (rec.next_session_plan) writeBlock("Combinado / tarefa", rec.next_session_plan);
        y += 2;
      });

      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`${i} / ${total}`, pageW - margin, pageH - 8, { align: "right" });
      }

      const safe = patientName.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
      doc.save(`historico-sessoes-${safe || "paciente"}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o PDF");
    } finally {
      setExporting(false);
    }
  };

  const startEdit = (rec: UnifiedRecord) => {
    setEditingId(rec.id);
    setEditDraft({
      chief_complaint: rec.chief_complaint ?? "",
      clinical_observations: rec.clinical_observations ?? "",
      next_session_plan: rec.next_session_plan ?? "",
    });
  };

  const saveEdit = async (rec: UnifiedRecord) => {
    setSaving(true);
    try {
      const rawId = rec.id.split(":")[1];
      const chief = editDraft.chief_complaint.trim() || null;
      const obs = editDraft.clinical_observations.trim() || null;
      const plan = editDraft.next_session_plan.trim() || null;

      if (rec.source === "legacy") {
        const { error } = await supabase
          .from("session_records")
          .update({ chief_complaint: chief, clinical_observations: obs, next_session_plan: plan })
          .eq("id", rawId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_progress")
          .update({ patient_context: chief, clinical_observation: obs })
          .eq("id", rawId);
        if (error) throw error;
      }

      const patch = (r: UnifiedRecord): UnifiedRecord =>
        r.id === rec.id
          ? {
              ...r,
              chief_complaint: chief,
              clinical_observations: obs,
              next_session_plan: rec.source === "legacy" ? plan : r.next_session_plan,
            }
          : r;

      setRecords((prev) => prev.map(patch));
      setRecordsBySession((prev) => {
        const next: Record<string, UnifiedRecord> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = patch(v);
        return next;
      });
      setEditingId(null);
      toast.success("Registro atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o registro");
    } finally {
      setSaving(false);
    }
  };

  const modalityOptions = Array.from(
    new Set(agenda.map((s) => (s.modality ?? "").trim()).filter(Boolean))
  ).sort();

  const now = Date.now();
  const filteredAgenda = agenda.filter((s) => {
    const t = new Date(s.scheduled_at).getTime();
    if (periodFilter === "upcoming" && t < now) return false;
    if (periodFilter === "past" && t >= now) return false;
    if (periodFilter === "30d" && (t < now - 30 * 86400000 || t > now)) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (modalityFilter !== "all" && (s.modality ?? "").trim() !== modalityFilter) return false;
    return true;
  });
  // Próximas sessões em ordem crescente; demais recortes, mais recentes primeiro
  if (periodFilter === "upcoming") {
    filteredAgenda.sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  }




  useEffect(() => {
    (async () => {
      setLoading(true);
      const [legacyRes, v2Res, firstRecordRes, firstSessionRes, patientRes] = await Promise.all([
        // 1) Legado — leitura apenas
        supabase
          .from("session_records")
          .select("id, session_id, session_date, session_number, modality, duration_minutes, chief_complaint, themes, clinical_observations, next_session_plan, engagement, risk_indicator, private_notes, created_at")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: false })
          .limit(15),
        // 2) Novo fluxo — patient_progress (sem embed; sessions carrega em segunda query)
        // Filtro trata data_model NULL: aceita NULL OU diferente de 'legacy_unclassified'
        supabase
          .from("patient_progress")
          .select("id, session_id, recorded_at, created_at, wellbeing_score, patient_context, clinical_observation, emotions, themes, engagement, attention_flag, private_notes, data_model")
          .eq("patient_id", patientId)
          .or("data_model.is.null,data_model.neq.legacy_unclassified")
          .order("recorded_at", { ascending: false })
          .limit(15),
        supabase
          .from("session_records")
          .select("session_date")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: true })
          .limit(1),
        supabase
          .from("sessions")
          .select("scheduled_at")
          .eq("patient_id", patientId)
          .order("scheduled_at", { ascending: true })
          .limit(1),
        supabase
          .from("patients")
          .select("treatment_start_date, created_at")
          .eq("id", patientId)
          .maybeSingle(),
      ]);

      const legacyRows = (legacyRes.data ?? []) as any[];
      const v2Rows = (v2Res.data ?? []) as any[];

      // Segunda query: buscar metadados das sessões referenciadas pelos registros v2
      const v2SessionIdList = Array.from(
        new Set(v2Rows.map((r) => r.session_id).filter((sid): sid is string => !!sid))
      );
      const sessionsMap = new Map<string, { scheduled_at: string | null; modality: string | null; duration_minutes: number | null; status: string | null; next_session_plan: string | null }>();
      const homeworkMap = new Map<string, { title: string | null; weekly_goal: string | null; actions: any }>();
      if (v2SessionIdList.length > 0) {
        const [sessRes, hwRes] = await Promise.all([
          supabase
            .from("sessions")
            .select("id, scheduled_at, modality, duration_minutes, status, next_session_plan")
            .in("id", v2SessionIdList),
          supabase
            .from("homework_tasks")
            .select("session_id, title, weekly_goal, actions")
            .in("session_id", v2SessionIdList),
        ]);
        (sessRes.data ?? []).forEach((s: any) => {
          sessionsMap.set(s.id, {
            scheduled_at: s.scheduled_at ?? null,
            modality: s.modality ?? null,
            duration_minutes: s.duration_minutes ?? null,
            status: s.status ?? null,
            next_session_plan: s.next_session_plan ?? null,
          });
        });
        (hwRes.data ?? []).forEach((h: any) => {
          if (h.session_id) homeworkMap.set(h.session_id, { title: h.title, weekly_goal: h.weekly_goal, actions: h.actions });
        });
      }


      // Set de session_id cobertos por registros v2 — usado para deduplicar legado
      const v2SessionIds = new Set(v2SessionIdList);

      const legacyUnified: UnifiedRecord[] = legacyRows
        .filter((r) => !(r.session_id && v2SessionIds.has(r.session_id)))
        .map((r) => ({
          id: `legacy:${r.id}`,
          source: "legacy" as const,
          session_id: r.session_id ?? null,
          session_date: r.session_date,
          session_number: r.session_number ?? null,
          modality: r.modality ?? null,
          duration_minutes: r.duration_minutes ?? null,
          chief_complaint: r.chief_complaint ?? null,
          clinical_observations: r.clinical_observations ?? null,
          themes: r.themes ?? null,
          emotions: null,
          wellbeing_score: null,
          engagement: r.engagement ?? null,
          attention_flag: legacyRiskToAttention(r.risk_indicator ?? null),
          private_notes: r.private_notes ?? null,
          next_session_plan: r.next_session_plan ?? null,
          created_at: r.created_at,
        }));

      const v2Unified: UnifiedRecord[] = v2Rows.map((r) => {
        const sess = r.session_id ? sessionsMap.get(r.session_id) ?? null : null;
        const hw = r.session_id ? homeworkMap.get(r.session_id) ?? null : null;
        // Combinado/tarefa: prioridade homework (weekly_goal > ações > título) > next_session_plan da sessão
        let combinado: string | null = null;
        if (hw) {
          if (hw.weekly_goal && String(hw.weekly_goal).trim()) {
            combinado = String(hw.weekly_goal).trim();
          } else if (Array.isArray(hw.actions) && hw.actions.length > 0) {
            combinado = hw.actions
              .map((a: any) => (typeof a === "string" ? a : a?.text ?? ""))
              .filter(Boolean)
              .map((t: string, i: number) => `${i + 1}. ${t}`)
              .join("\n");
          } else if (hw.title && String(hw.title).trim()) {
            combinado = String(hw.title).trim();
          }
        }
        if (!combinado && sess?.next_session_plan) combinado = sess.next_session_plan;
        return {
          id: `v2:${r.id}`,
          source: "v2" as const,
          session_id: r.session_id ?? null,
          session_date: sess?.scheduled_at ?? r.recorded_at ?? r.created_at,
          session_number: null,
          modality: sess?.modality ?? null,
          duration_minutes: sess?.duration_minutes ?? null,
          chief_complaint: r.patient_context ?? null,
          clinical_observations: r.clinical_observation ?? null,
          themes: r.themes ?? null,
          emotions: normalizeEmotions(r.emotions),
          wellbeing_score: r.wellbeing_score ?? null,
          engagement: r.engagement ?? null,
          attention_flag: r.attention_flag && r.attention_flag !== "none" ? r.attention_flag : null,
          private_notes: r.private_notes ?? null,
          next_session_plan: combinado,
          created_at: r.created_at,
        };
      });

      const merged = [...v2Unified, ...legacyUnified]
        .sort((a, b) => (parseSessionDate(b.session_date)?.getTime() ?? 0) - (parseSessionDate(a.session_date)?.getTime() ?? 0));

      const bySession: Record<string, UnifiedRecord> = {};
      merged.forEach((r) => {
        if (r.session_id && !bySession[r.session_id]) bySession[r.session_id] = r;
      });
      setRecordsBySession(bySession);
      setRecords(merged.slice(0, 3));

      const agendaRes = await supabase
        .from("sessions")
        .select("id, scheduled_at, status, modality, duration_minutes")
        .eq("patient_id", patientId)
        .order("scheduled_at", { ascending: false })
        .limit(40);
      setAgenda((agendaRes.data ?? []) as any[]);


      const candidates: Array<string | null | undefined> = [
        patientRes.data?.treatment_start_date,
        firstRecordRes.data?.[0]?.session_date,
        firstSessionRes.data?.[0]?.scheduled_at,
        patientRes.data?.created_at,
      ];
      const first = candidates.find((v) => !!v) ?? null;
      setStartDate(first ? new Date(first) : null);
      setLoading(false);
    })();
  }, [patientId]);


  return (
    <div className="space-y-5">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryTile label="Próxima sessão" value={fmtDate(nextDate)} />
        <SummaryTile label="Última sessão" value={fmtDate(lastDate)} />
        <SummaryTile label="Sessões registradas" value={totalRecords > 0 ? String(totalRecords) : "—"} />
        <SummaryTile label="Em acompanhamento há" value={followUpLabel(startDate)} />
      </div>

      {/* Linha do tempo */}
      <SessionTimeline patientId={patientId} onNavigate={onNavigateAway} />

      {/* Visão semanal */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-display font-semibold text-foreground">Semana</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart((d) => addDays(d, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[11px] text-muted-foreground min-w-[110px] text-center">
              {format(weekStart, "dd/MM", { locale: ptBR })} – {format(addDays(weekStart, 6), "dd/MM", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart((d) => addDays(d, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Hoje
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDays.map(({ day, sessions }) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className="rounded-xl p-2 min-h-[86px]"
                style={{
                  background: isToday ? "hsl(var(--primary) / 0.06)" : "hsl(var(--background))",
                  border: `0.5px solid hsl(var(--border))`,
                }}
              >
                <p className="text-[10px] uppercase text-muted-foreground mb-1.5">
                  {format(day, "EEE dd/MM", { locale: ptBR })}
                </p>
                {sessions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/60">—</p>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((s) => {
                      const rec = recordsBySession[s.id] ?? null;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (rec) setDetail(rec);
                            else toast.info("Esta sessão ainda não tem registro escrito.");
                          }}
                          className="w-full text-left rounded-lg px-2 py-1 transition-colors hover:bg-primary/10"
                          style={{ background: rec ? "hsl(var(--primary) / 0.08)" : "hsl(var(--muted))" }}
                          title={rec ? "Ver registro escrito" : "Sem registro"}
                        >
                          <span className="block text-[11px] font-medium text-foreground">
                            {format(new Date(s.scheduled_at), "HH:mm")}
                          </span>
                          <span className="block text-[10px] text-muted-foreground truncate">
                            {SESSION_STATUS_LABEL[s.status] ?? s.status}
                            {rec ? " · registro" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessões agendadas + conteúdo registrado */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-display font-semibold text-foreground">Sessões agendadas</h3>
          <div className="flex items-center gap-2">
            {(periodFilter !== "upcoming" || statusFilter !== "all" || modalityFilter !== "all") && (
              <button
                type="button"
                onClick={() => { setPeriodFilter("upcoming"); setStatusFilter("all"); setModalityFilter("all"); }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Limpar filtros
              </button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportPdf} disabled={exporting || agenda.length === 0}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Exportar PDF
            </Button>
          </div>
        </div>


        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="upcoming">Próximas sessões</SelectItem>
              <SelectItem value="past">Sessões passadas</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Todas as datas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(SESSION_STATUS_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modalityFilter} onValueChange={setModalityFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Modalidade" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Todas as modalidades</SelectItem>
              {modalityOptions.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : filteredAgenda.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Calendar className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">
              {agenda.length === 0
                ? "Nenhuma sessão agendada para este paciente."
                : "Nenhuma sessão encontrada com esses filtros."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAgenda.map((s) => {

              const rec = recordsBySession[s.id] ?? null;
              const open = !!expandedSession[s.id];
              const dt = new Date(s.scheduled_at);
              return (
                <div
                  key={s.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
                >
                  <button
                    type="button"
                    onClick={() => rec && setExpandedSession((st) => ({ ...st, [s.id]: !open }))}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize truncate">
                        {SESSION_STATUS_LABEL[s.status] ?? s.status}
                        {s.modality ? ` · ${s.modality}` : ""}
                        {s.duration_minutes != null ? ` · ${s.duration_minutes} min` : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          rec ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {rec ? "Com registro" : "Sem registro"}
                      </span>
                      {rec && (open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
                    </span>
                  </button>

                  {rec && open && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border/60 pt-3">
                      {editingId === rec.id ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">Queixa / contexto</p>
                            <Textarea
                              value={editDraft.chief_complaint}
                              onChange={(e) => setEditDraft((d) => ({ ...d, chief_complaint: e.target.value }))}
                              rows={3}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">Observação clínica</p>
                            <Textarea
                              value={editDraft.clinical_observations}
                              onChange={(e) => setEditDraft((d) => ({ ...d, clinical_observations: e.target.value }))}
                              rows={5}
                              className="text-sm"
                            />
                          </div>
                          {rec.source === "legacy" && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground mb-1">Combinado / tarefa</p>
                              <Textarea
                                value={editDraft.next_session_plan}
                                onChange={(e) => setEditDraft((d) => ({ ...d, next_session_plan: e.target.value }))}
                                rows={3}
                                className="text-sm"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => saveEdit(rec)} disabled={saving}>
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Salvar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {rec.chief_complaint && (
                            <Section title="Queixa / contexto">{rec.chief_complaint}</Section>
                          )}
                          {rec.clinical_observations && (
                            <Section title="Observação clínica">{rec.clinical_observations}</Section>
                          )}
                          {rec.themes && rec.themes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {rec.themes.filter(Boolean).map((t) => (
                                <span key={t} className="text-[11px] px-2.5 py-0.5 rounded-full bg-lilac/40 text-foreground">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {rec.next_session_plan && (
                            <Section title="Combinado / tarefa">{rec.next_session_plan}</Section>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(rec)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <Pencil className="h-3 w-3" /> Editar conteúdo
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setDetail(rec)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Abrir registro completo <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>



      {/* Últimos registros de sessão */}
      <div>
        <h3 className="text-sm font-display font-semibold text-foreground mb-3">
          Últimos registros
        </h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <FileText className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">Nenhum registro de sessão ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => {
              const themes = (r.themes ?? []).filter(Boolean).slice(0, 3);
              const obs = r.clinical_observations ?? "";
              const isExpanded = !!expandedObs[r.id];
              const isLong = obs.length > 200 || obs.split("\n").length > 3;
              const attentionLabel = r.attention_flag ? ATTENTION_LABEL[r.attention_flag] : null;

              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 space-y-4"
                  style={{ background: "hsl(var(--background))", border: "0.5px solid hsl(var(--border))" }}
                >
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className="h-4 w-4 text-primary" />
                      <p className="text-base font-display font-semibold text-foreground leading-tight">
                        {format(parseSessionDate(r.session_date) ?? new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                      {r.session_number != null && (
                        <span className="text-[11px] text-muted-foreground">#{r.session_number}</span>
                      )}
                      <SourceBadge source={r.source} />
                      {r.source === "v2" && r.wellbeing_score != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Bem-estar {r.wellbeing_score}/10
                        </span>
                      )}
                    </div>
                    {attentionLabel && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-destructive/15 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {attentionLabel}
                      </span>
                    )}
                  </div>

                  {/* Queixa/contexto + Observação clínica */}
                  {(obs || r.chief_complaint) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">O que aconteceu nesta sessão</p>
                      {r.chief_complaint && !obs && (
                        <p className="text-sm text-foreground/90 whitespace-pre-line line-clamp-3">
                          {r.chief_complaint}
                        </p>
                      )}
                      {obs && (
                        <>
                          <p
                            className={`text-sm text-foreground/90 whitespace-pre-line ${isExpanded ? "" : "line-clamp-3"}`}
                          >
                            {obs}
                          </p>
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => setExpandedObs((s) => ({ ...s, [r.id]: !isExpanded }))}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              {isExpanded ? (
                                <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
                              ) : (
                                <><ChevronDown className="h-3 w-3" /> Mostrar mais</>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Temas */}
                  {themes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                        <Target className="h-3 w-3" /> Técnicas / temas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {themes.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-lilac/40 text-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Combinado / Tarefa — legado somente (v2 oculto até integração com session_plans) */}
                  {r.next_session_plan && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 inline-flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" /> Combinado / tarefa
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-line line-clamp-3">
                        {r.next_session_plan}
                      </p>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setDetail(r)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Abrir registro <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {records.length > 0 && (
        <button
          type="button"
          onClick={onOpenFullHistory}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            background: "hsl(var(--primary))",
            color: "#fff",
            borderRadius: 40,
            padding: "10px 16px",
            fontFamily: "Syne, sans-serif",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <FileText className="h-4 w-4" /> Ver histórico completo
        </button>
      )}

      {/* Drawer com registro completo */}
      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[560px] p-0"
          style={{ background: "hsl(var(--card))", borderLeft: "0.5px solid hsl(var(--border))" }}
        >
          <VisuallyHidden>
            <SheetTitle>Registro de sessão</SheetTitle>
            <SheetDescription>Detalhes completos do registro selecionado.</SheetDescription>
          </VisuallyHidden>
          {detail && (
            <div className="h-full overflow-y-auto p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] uppercase text-muted-foreground">Registro de sessão</p>
                  <SourceBadge source={detail.source} />
                </div>
                <h2 className="text-lg font-display font-semibold text-foreground">
                  {format(parseSessionDate(detail.session_date) ?? new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  {detail.session_number != null && (
                    <span className="ml-2 text-xs text-muted-foreground">Sessão #{detail.session_number}</span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground capitalize">
                  {detail.modality ?? "—"}
                  {detail.duration_minutes != null && ` · ${detail.duration_minutes} min`}
                  {detail.engagement != null && ` · Engajamento ${detail.engagement}/5`}
                  {detail.source === "v2" && detail.wellbeing_score != null && ` · Bem-estar ${detail.wellbeing_score}/10`}
                </p>
              </div>

              {detail.themes && detail.themes.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Temas</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.themes.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-lilac/40 text-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.emotions && detail.emotions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Emoções observadas</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.emotions.map((e) => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.chief_complaint && (
                <Section title="Queixa / contexto trazido">{detail.chief_complaint}</Section>
              )}
              {detail.clinical_observations && (
                <Section title="Observação clínica">{detail.clinical_observations}</Section>
              )}

              {detail.attention_flag && ATTENTION_LABEL[detail.attention_flag] && (
                <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                  <p className="text-[10px] uppercase text-destructive">Atenção clínica</p>
                  <p className="text-sm text-foreground">{ATTENTION_LABEL[detail.attention_flag]}</p>
                </div>
              )}

              {detail.source === "legacy" && detail.next_session_plan && (
                <Section title="Combinado / tarefa para a próxima sessão">{detail.next_session_plan}</Section>
              )}
              {detail.private_notes && (
                <div className="rounded-lg bg-background p-3 border border-border/60">
                  <p className="text-[10px] uppercase text-muted-foreground">Notas privadas</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{detail.private_notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase text-muted-foreground">{title}</p>
    <p className="text-sm text-foreground whitespace-pre-line">{children}</p>
  </div>
);
