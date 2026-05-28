import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, X, FileDown, ClipboardList, Target, Sparkles, History, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Patient = {
  id: string;
  full_name: string;
  is_active: boolean;
  treatment_start_date: string | null;
  treatment_end_date: string | null;
};
type GoalType = "geral" | "intermediaria" | "comportamental";

interface TreatmentPlan {
  id?: string;
  status: string;
  cid: string;
  abordagem: string[];
  conceitualizacao: string;
}
interface Goal { id: string; tipo: GoalType; descricao: string; ordem: number }
interface Technique { id: string; nome: string }
interface SessionPlan {
  id?: string;
  session_id: string | null;
  objetivo: string;
  meta_id: string | null;
  retomar: string;
  tecnicas: string[];
  observacoes: string;
}
interface Revision { id: string; data: string; sessao_ref: string; descricao: string }
interface NextSession { id: string; scheduled_at: string; duration_minutes: number }
interface TreatmentSession { id: string; scheduled_at: string; duration_minutes: number; status: string; notes: string | null }

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "alta", label: "Alta" },
];
const ABORDAGEM_OPTIONS = ["TCC", "TE", "ACT", "Outra"];
const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Falta",
  rescheduled: "Remarcada",
  cancelled: "Cancelada",
};
const GOAL_META = {
  geral:          { label: "Geral",          border: "border-l-[#6d4fc2]", chip: "bg-[#f0ebff] text-[#3d2b8a]" },
  intermediaria:  { label: "Intermediária",  border: "border-l-[#BA7517]", chip: "bg-[#fdf3e3] text-[#7a4a0a]" },
  comportamental: { label: "Comportamental", border: "border-l-[#1D9E75]", chip: "bg-[#e3f7ee] text-[#0e5e44]" },
} as const;

const PURPLE = "#6d4fc2";

const PlanoTratamento = () => {
  const { user } = useAuth();
  const uid = user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPatient = searchParams.get("patient");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>(queryPatient || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState<TreatmentPlan>({ status: "ativo", cid: "", abordagem: [], conceitualizacao: "" });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [newTech, setNewTech] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [treatmentSessions, setTreatmentSessions] = useState<TreatmentSession[]>([]);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan>({
    session_id: null, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "",
  });

  // load patients
  useEffect(() => {
    if (!uid) return;
    supabase.from("patients").select("id, full_name, is_active, treatment_start_date, treatment_end_date").eq("user_id", uid).eq("is_active", true).order("full_name")
      .then(({ data }) => {
        const list = (data || []) as Patient[];
        setPatients(list);
        if (!patientId && list.length) setPatientId(queryPatient || list[0].id);
      });
  }, [uid, patientId, queryPatient]);

  useEffect(() => {
    if (queryPatient && queryPatient !== patientId) setPatientId(queryPatient);
  }, [queryPatient, patientId]);

  // sync query param when patientId changes
  useEffect(() => {
    if (patientId && patientId !== queryPatient) {
      setSearchParams({ patient: patientId }, { replace: true });
    }
  }, [patientId]);

  const loadAll = useCallback(async () => {
    if (!uid || !patientId) return;
    setLoading(true);
    try {
      const [p, g, t, r, ns] = await Promise.all([
        supabase.from("treatment_plans").select("*").eq("patient_id", patientId).maybeSingle(),
        supabase.from("treatment_goals").select("*").eq("patient_id", patientId).order("ordem"),
        supabase.from("treatment_techniques").select("*").eq("patient_id", patientId).order("created_at"),
        supabase.from("treatment_revisions").select("*").eq("patient_id", patientId).order("data", { ascending: false }),
        supabase.from("sessions").select("id, scheduled_at, duration_minutes").eq("patient_id", patientId).eq("user_id", uid)
          .gte("scheduled_at", new Date().toISOString()).not("status", "in", "(cancelled,no_show)").order("scheduled_at").limit(1).maybeSingle(),
      ]);
      if (p.data) setPlan({
        id: p.data.id, status: p.data.status, cid: p.data.cid || "",
        abordagem: p.data.abordagem || [], conceitualizacao: p.data.conceitualizacao || "",
      });
      else setPlan({ status: "ativo", cid: "", abordagem: [], conceitualizacao: "" });
      setGoals((g.data || []) as Goal[]);
      setTechniques((t.data || []) as Technique[]);
      setRevisions((r.data || []) as Revision[]);
      setNextSession(ns.data as NextSession | null);

      const { data: sessionsData } = await supabase.from("sessions")
        .select("id, scheduled_at, duration_minutes, status, notes")
        .eq("patient_id", patientId)
        .eq("user_id", uid)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true });
      setTreatmentSessions((sessionsData || []) as TreatmentSession[]);

      // load session_plan for next session
      if (ns.data?.id) {
        const { data: sp } = await supabase.from("session_plans").select("*").eq("session_id", ns.data.id).maybeSingle();
        if (sp) setSessionPlan({
          id: sp.id, session_id: sp.session_id, objetivo: sp.objetivo || "", meta_id: sp.meta_id,
          retomar: sp.retomar || "", tecnicas: sp.tecnicas || [], observacoes: sp.observacoes || "",
        });
        else setSessionPlan({ session_id: ns.data.id, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "" });
      } else {
        setSessionPlan({ session_id: null, objetivo: "", meta_id: null, retomar: "", tecnicas: [], observacoes: "" });
      }
    } finally {
      setLoading(false);
    }
  }, [uid, patientId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── save handlers ── */
  const savePlan = async () => {
    if (!uid || !patientId) return;
    setSaving(true);
    const payload = { user_id: uid, patient_id: patientId, status: plan.status, cid: plan.cid, abordagem: plan.abordagem, conceitualizacao: plan.conceitualizacao };
    const { error } = plan.id
      ? await supabase.from("treatment_plans").update(payload).eq("id", plan.id)
      : await supabase.from("treatment_plans").upsert(payload, { onConflict: "patient_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar plano"); else { toast.success("Plano salvo"); loadAll(); }
  };

  const saveSessionPlan = async () => {
    if (!uid || !patientId) return;
    setSaving(true);
    const payload = { ...sessionPlan, user_id: uid, patient_id: patientId };
    const { error } = sessionPlan.id
      ? await supabase.from("session_plans").update(payload).eq("id", sessionPlan.id)
      : await supabase.from("session_plans").insert(payload);
    setSaving(false);
    if (error) toast.error("Erro ao salvar"); else { toast.success("Próxima sessão salva"); loadAll(); }
  };

  const addGoal = async () => {
    if (!uid || !patientId) return;
    const { data, error } = await supabase.from("treatment_goals")
      .insert({ user_id: uid, patient_id: patientId, tipo: "geral", descricao: "", ordem: goals.length })
      .select().single();
    if (error) return toast.error("Erro");
    setGoals([...goals, data as Goal]);
  };
  const updateGoal = async (id: string, patch: Partial<Goal>) => {
    setGoals(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g));
    await supabase.from("treatment_goals").update(patch).eq("id", id);
  };
  const removeGoal = async (id: string) => {
    setGoals(gs => gs.filter(g => g.id !== id));
    await supabase.from("treatment_goals").delete().eq("id", id);
  };

  const addTechnique = async () => {
    if (!newTech.trim() || !uid || !patientId) return;
    const { data, error } = await supabase.from("treatment_techniques")
      .insert({ user_id: uid, patient_id: patientId, nome: newTech.trim() }).select().single();
    if (error) return toast.error("Erro");
    setTechniques([...techniques, data as Technique]);
    setNewTech("");
  };
  const removeTechnique = async (id: string) => {
    setTechniques(ts => ts.filter(t => t.id !== id));
    await supabase.from("treatment_techniques").delete().eq("id", id);
  };

  const addRevision = async () => {
    if (!uid || !patientId) return;
    const desc = window.prompt("Descrição da revisão:");
    if (!desc?.trim()) return;
    const ref = window.prompt("Número/referência da sessão (opcional):") || "";
    const { data, error } = await supabase.from("treatment_revisions")
      .insert({ user_id: uid, patient_id: patientId, descricao: desc.trim(), sessao_ref: ref }).select().single();
    if (error) return toast.error("Erro");
    setRevisions([data as Revision, ...revisions]);
    toast.success("Revisão registrada");
  };

  const toggleAbordagem = (v: string) => {
    setPlan(p => ({ ...p, abordagem: p.abordagem.includes(v) ? p.abordagem.filter(x => x !== v) : [...p.abordagem, v] }));
  };

  const toggleSessionTech = (nome: string) => {
    setSessionPlan(sp => ({ ...sp, tecnicas: sp.tecnicas.includes(nome) ? sp.tecnicas.filter(x => x !== nome) : [...sp.tecnicas, nome] }));
  };

  const exportPdf = () => {
    const patient = patients.find(p => p.id === patientId);
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Plano de Tratamento — ${patient?.full_name || ""}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#222;padding:32px;max-width:780px;margin:auto;line-height:1.55}
  h1{color:${PURPLE};font-size:24px;margin:0 0 4px}
  h2{color:${PURPLE};font-size:16px;border-bottom:2px solid ${PURPLE}33;padding-bottom:4px;margin-top:28px}
  .meta{color:#666;font-size:13px;margin-bottom:16px}
  .tags span{display:inline-block;background:#f0ebff;color:#3d2b8a;padding:3px 10px;border-radius:12px;font-size:12px;margin:2px 4px 2px 0}
  .goal{border-left:4px solid #6d4fc2;padding:8px 12px;margin:8px 0;background:#fafafa;border-radius:6px}
  .goal.intermediaria{border-color:#BA7517}.goal.comportamental{border-color:#1D9E75}
  .rev{padding:8px 0;border-bottom:1px solid #eee}
  pre{white-space:pre-wrap;font-family:inherit;margin:6px 0}
</style></head><body>
<h1>Plano de Tratamento</h1>
<div class="meta"><strong>${patient?.full_name || ""}</strong> · Status: ${STATUS_OPTIONS.find(s => s.value === plan.status)?.label} · Emitido em ${format(new Date(), "dd/MM/yyyy")}</div>

<h2>Diagnóstico e Formulação</h2>
<p><strong>CID:</strong> ${plan.cid || "—"}</p>
<p><strong>Abordagem:</strong> ${plan.abordagem.join(", ") || "—"}</p>
<pre>${plan.conceitualizacao || "—"}</pre>

<h2>Metas Terapêuticas</h2>
${goals.length ? goals.map(g => `<div class="goal ${g.tipo}"><strong>${GOAL_META[g.tipo].label}:</strong> ${g.descricao || "—"}</div>`).join("") : "<p>—</p>"}

<h2>Técnicas do Plano</h2>
<div class="tags">${techniques.map(t => `<span>${t.nome}</span>`).join("") || "—"}</div>

${nextSession ? `<h2>Próxima Sessão — ${format(new Date(nextSession.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</h2>
<p><strong>Objetivo:</strong> ${sessionPlan.objetivo || "—"}</p>
<p><strong>Retomar:</strong> ${sessionPlan.retomar || "—"}</p>
<p><strong>Técnicas:</strong> ${sessionPlan.tecnicas.join(", ") || "—"}</p>
<p><strong>Observações:</strong> ${sessionPlan.observacoes || "—"}</p>` : ""}

<h2>Histórico de Revisões</h2>
${revisions.length ? revisions.map(r => `<div class="rev"><strong>${format(new Date(r.data), "dd/MM/yyyy")}</strong> ${r.sessao_ref ? `· ${r.sessao_ref}` : ""}<br/>${r.descricao}</div>`).join("") : "<p>—</p>"}
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Bloqueador de pop-up impediu a impressão");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const goalsForSelect = useMemo(() => goals.filter(g => g.descricao.trim()), [goals]);

  if (!uid) return null;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: `${PURPLE}15`, color: PURPLE }}>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Plano de tratamento</h1>
            <p className="text-sm text-muted-foreground">Organize objetivos, técnicas e revisões do tratamento</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
            <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>

          <Select value={plan.status} onValueChange={v => setPlan(p => ({ ...p, status: v }))}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>

          <Button variant="ghost" onClick={exportPdf} disabled={!patientId}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button variant="accent" onClick={savePlan} disabled={!patientId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar plano
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : !patientId ? (
        <Card className="p-10 text-center text-muted-foreground">Cadastre um paciente para começar.</Card>
      ) : (
        <>
          {/* BLOCO 1 — Próxima sessão */}
          <Card className="p-6 rounded-2xl border-l-4" style={{ borderLeftColor: PURPLE }}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5" style={{ color: PURPLE }} />
              <h2 className="font-display text-lg font-bold">Próxima sessão</h2>
            </div>

            {nextSession ? (
              <p className="text-sm text-muted-foreground mb-4">
                {format(new Date(nextSession.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} · {nextSession.duration_minutes} min
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Nenhuma sessão futura agendada para este paciente.</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Objetivo da sessão</Label>
                <Textarea value={sessionPlan.objetivo} onChange={e => setSessionPlan(sp => ({ ...sp, objetivo: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>Meta vinculada</Label>
                <Select value={sessionPlan.meta_id || "none"} onValueChange={v => setSessionPlan(sp => ({ ...sp, meta_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma meta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhuma —</SelectItem>
                    {goalsForSelect.map(g => (
                      <SelectItem key={g.id} value={g.id}>[{GOAL_META[g.tipo].label}] {g.descricao.slice(0, 60)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>O que retomar da sessão anterior</Label>
                <Textarea value={sessionPlan.retomar} onChange={e => setSessionPlan(sp => ({ ...sp, retomar: e.target.value }))} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Label>Técnicas a utilizar</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {techniques.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleSessionTech(t.nome)}
                      className={cn("px-3 py-1 rounded-full text-xs border transition-colors",
                        sessionPlan.tecnicas.includes(t.nome)
                          ? "bg-[#6d4fc2] text-white border-[#6d4fc2]"
                          : "bg-white text-[#6d4fc2] border-[#6d4fc2]/30 hover:bg-[#f0ebff]")}>
                      {t.nome}
                    </button>
                  ))}
                  {techniques.length === 0 && <span className="text-xs text-muted-foreground">Adicione técnicas no bloco abaixo.</span>}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Observações / lembretes</Label>
                <Textarea value={sessionPlan.observacoes} onChange={e => setSessionPlan(sp => ({ ...sp, observacoes: e.target.value }))}
                  rows={2} placeholder="Ex: paciente mencionou situação com a mãe — retomar se trouxer..." />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="accent" size="sm" onClick={saveSessionPlan}>Salvar próxima sessão</Button>
            </div>
          </Card>

          {/* BLOCO 2 — Diagnóstico e Formulação */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Diagnóstico e formulação</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>CID-11</Label>
                  <Input value={plan.cid} onChange={e => setPlan(p => ({ ...p, cid: e.target.value }))} placeholder="Ex: 6B00 Transtorno de ansiedade generalizada" />
                </div>
                <div>
                  <Label className="mb-2 block">Abordagem</Label>
                  <div className="flex flex-wrap gap-3">
                    {ABORDAGEM_OPTIONS.map(a => (
                      <label key={a} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={plan.abordagem.includes(a)} onCheckedChange={() => toggleAbordagem(a)} />
                        <span className="text-sm">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Conceitualização resumida</Label>
                <Textarea value={plan.conceitualizacao} onChange={e => setPlan(p => ({ ...p, conceitualizacao: e.target.value }))} rows={8} />
              </div>
            </div>
          </Card>

          {/* BLOCO 3 — Metas */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Metas terapêuticas</h2>
              </div>
              <Button variant="outline" size="sm" onClick={addGoal}><Plus className="h-4 w-4" /> Adicionar meta</Button>
            </div>

            <div className="space-y-3">
              {goals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>}
              {goals.map(g => (
                <div key={g.id} className={cn("border-l-4 bg-card border border-border rounded-xl p-3 flex gap-3 items-start", GOAL_META[g.tipo].border)}>
                  <Select value={g.tipo} onValueChange={(v) => updateGoal(g.id, { tipo: v as GoalType })}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GOAL_META) as GoalType[]).map(k => <SelectItem key={k} value={k}>{GOAL_META[k].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea value={g.descricao} onChange={e => updateGoal(g.id, { descricao: e.target.value })} rows={2} className="flex-1" placeholder="Descreva a meta..." />
                  <Button variant="ghost" size="icon" onClick={() => removeGoal(g.id)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </Card>

          {/* BLOCO 4 — Técnicas */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Técnicas do plano</h2>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {techniques.map(t => (
                <Badge key={t.id} variant="secondary" className="pl-3 pr-1 py-1 gap-1 text-sm">
                  {t.nome}
                  <button onClick={() => removeTechnique(t.id)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {techniques.length === 0 && <span className="text-sm text-muted-foreground">Adicione técnicas abaixo.</span>}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input value={newTech} onChange={e => setNewTech(e.target.value)} placeholder="Ex: Reestruturação cognitiva"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTechnique())} />
              <Button variant="outline" onClick={addTechnique}><Plus className="h-4 w-4" /></Button>
            </div>
          </Card>

          {/* BLOCO 5 — Revisões */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Histórico de revisões</h2>
              </div>
              <Button variant="outline" size="sm" onClick={addRevision}><Plus className="h-4 w-4" /> Nova revisão</Button>
            </div>

            {revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma revisão registrada ainda.</p>
            ) : (
              <div className="relative pl-6 space-y-4 border-l-2 border-[#ede9f8]">
                {revisions.map(r => (
                  <div key={r.id} className="relative">
                    <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-[#6d4fc2] border-2 border-background" />
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(new Date(r.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {r.sessao_ref && <span> · Sessão {r.sessao_ref}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default PlanoTratamento;
