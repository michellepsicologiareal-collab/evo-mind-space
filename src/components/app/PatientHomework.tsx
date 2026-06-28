import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Send, Trash2, Download, MessageCircle, FileText, ExternalLink, Pencil, CheckSquare, Square, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";

interface Props {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  homeworkToken: string | null;
  therapistFirstName?: string;
}

interface Task {
  id: string;
  title: string;
  content: string;
  session_points: string | null;
  actions: Json | null;
  weekly_observations: string | null;
  sent_at: string | null;
  created_at: string;
  session_record_id: string | null;
}

interface ActionItem {
  text: string;
  done: boolean;
}

export function normalizeActions(raw: Json | null | undefined): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: any) => ({
    text: typeof a === "string" ? a : (a?.text || ""),
    done: !!a?.done,
  }));
}

interface SessionRecordOpt {
  id: string;
  session_date: string;
  session_number: number | null;
  next_session_plan: string | null;
  clinical_observations: string | null;
}

export const PatientHomework = ({ patientId, patientName, patientPhone, homeworkToken, therapistFirstName }: Props) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [records, setRecords] = useState<SessionRecordOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [sessionPoints, setSessionPoints] = useState("");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [actionInput, setActionInput] = useState("");
  const [weeklyObservations, setWeeklyObservations] = useState("");
  const [sourceRecord, setSourceRecord] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const publicUrl = homeworkToken ? `${window.location.origin}/tarefas/${homeworkToken}` : null;

  const load = async () => {
    setLoading(true);
    const [t, r] = await Promise.all([
      supabase.from("homework_tasks").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
      supabase.from("session_records").select("id, session_date, session_number, next_session_plan, clinical_observations").eq("patient_id", patientId).order("session_date", { ascending: false }).limit(20),
    ]);
    setTasks((t.data as Task[]) ?? []);
    setRecords((r.data as SessionRecordOpt[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId]);

  const resetForm = () => {
    setTitle("");
    setSessionPoints("");
    setActions([]);
    setActionInput("");
    setWeeklyObservations("");
    setSourceRecord("none");
    setEditing(null);
  };

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (t: Task) => {
    setEditing(t);
    setTitle(t.title);
    setSessionPoints(t.session_points || "");
    setActions(normalizeActions(t.actions));
    setWeeklyObservations(t.weekly_observations || "");
    setSourceRecord(t.session_record_id ?? "none");
    setOpen(true);
  };

  const fillFromRecord = (recordId: string) => {
    setSourceRecord(recordId);
    if (recordId === "none") return;
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    if (rec.clinical_observations) setSessionPoints(rec.clinical_observations);
    if (rec.next_session_plan) {
      const lines = rec.next_session_plan.split(/\n|\.\s+/).map((s) => s.trim()).filter(Boolean);
      setActions(lines.map((text) => ({ text, done: false })));
    }
    if (!title) setTitle(`Plano da sessão de ${format(new Date(rec.session_date), "dd/MM/yyyy")}`);
  };

  const addAction = () => {
    const text = actionInput.trim();
    if (!text) return;
    setActions((prev) => [...prev, { text, done: false }]);
    setActionInput("");
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAction = (index: number) => {
    setActions((prev) => prev.map((a, i) => i === index ? { ...a, done: !a.done } : a));
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Preencha o título do plano"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload: any = {
      title: title.trim(),
      content: "", // legado, mantido vazio para novos registros
      session_points: sessionPoints.trim() || null,
      actions: actions.length > 0 ? (actions as unknown as Json) : null,
      weekly_observations: weeklyObservations.trim() || null,
      session_record_id: sourceRecord === "none" ? null : sourceRecord,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from("homework_tasks").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("homework_tasks").insert({ ...payload, patient_id: patientId, user_id: user.id }));
    }
    setSaving(false);
    if (err) { toast.error("Erro ao salvar"); return; }
    toast.success(editing ? "Plano atualizado" : "Plano criado");
    setOpen(false);
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("homework_tasks").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Plano excluído");
    load();
  };

  const sendWhats = async (task: Task) => {
    const digits = normalizePhoneForWhatsApp(patientPhone);
    if (!digits) { toast.error("Paciente sem WhatsApp cadastrado"); return; }
    if (!publicUrl) { toast.error("Token público indisponível"); return; }
    const firstName = patientName.split(" ")[0];
    const psiName = therapistFirstName || "sua psi";
    const parts: string[] = [
      `Olá, ${firstName}! Aqui é a ${psiName}.`,
      "",
      `Segue seu *Plano entre Sessões*: ${task.title}`,
      "",
    ];
    if (task.session_points) {
      parts.push("📝 *Pontos importantes da sessão:*");
      parts.push(task.session_points);
      parts.push("");
    }
    const taskActions = normalizeActions(task.actions);
    if (taskActions.length > 0) {
      parts.push("🎯 *Plano entre Sessões:*");
      taskActions.forEach((a: any, i: number) => {
        const text = typeof a === "string" ? a : (a?.text || "");
        parts.push(`${i + 1}. ${text}`);
      });
      parts.push("");
    }
    if (task.weekly_observations) {
      parts.push("👀 *O que observar durante a semana:*");
      parts.push(task.weekly_observations);
      parts.push("");
    }
    parts.push("Você pode acompanhar todos os planos pelo link abaixo (também gera PDF):");
    parts.push(publicUrl);
    parts.push("");
    parts.push("Qualquer dúvida, estou por aqui.");
    const msg = parts.join("\n");
    if (!task.sent_at) {
      await supabase.from("homework_tasks").update({ sent_at: new Date().toISOString() }).eq("id", task.id);
      load();
    }
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {publicUrl && (
            <>Link público:{" "}
              <a href={publicUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                abrir <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {publicUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={publicUrl} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> Baixar PDF</a>
            </Button>
          )}
          <Button variant="accent" size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Novo plano</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum plano entre sessões criado ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie planos a partir do que anotou no registro de sessão.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((t) => {
            const taskActions = normalizeActions(t.actions);
            return (
              <div key={t.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-semibold text-foreground">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Criado {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      {t.sent_at && ` · Enviado ${format(new Date(t.sent_at), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(t.id)} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="accent" size="sm" className="gap-1.5 text-xs" onClick={() => sendWhats(t)}>
                      <MessageCircle className="h-3.5 w-3.5" /> {t.sent_at ? "Reenviar" : "Enviar"}
                    </Button>
                  </div>
                </div>

                {t.session_points && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">📝 Pontos importantes da sessão</p>
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{t.session_points}</p>
                  </div>
                )}

                {taskActions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">🎯 Plano entre Sessões</p>
                    <ul className="space-y-1">
                      {taskActions.map((a: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          <span className="leading-relaxed">{typeof a === "string" ? a : (a?.text || "")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {t.weekly_observations && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">👀 O que observar durante a semana</p>
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{t.weekly_observations}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar plano" : "Novo Plano entre Sessões"}</DialogTitle>
            <DialogDescription>Para {patientName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {records.length > 0 && !editing && (
              <div>
                <Label className="text-xs">Preencher a partir de um registro de sessão (opcional)</Label>
                <Select value={sourceRecord} onValueChange={fillFromRecord}>
                  <SelectTrigger><SelectValue placeholder="Escolher registro..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Plano livre —</SelectItem>
                    {records.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {format(new Date(r.session_date), "dd/MM/yyyy", { locale: ptBR })}
                        {r.session_number != null && ` · Sessão #${r.session_number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Título do plano</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Semana 3 — Consolidando insights" maxLength={200} />
            </div>

            <div>
              <Label className="text-xs">📝 Pontos importantes da sessão</Label>
              <Textarea
                value={sessionPoints}
                onChange={(e) => setSessionPoints(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Registre os principais insights, orientações e pontos abordados na sessão..."
              />
            </div>

            <div>
              <Label className="text-xs">🎯 Plano entre Sessões</Label>
              <div className="flex gap-2">
                <Input
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  placeholder="Adicionar uma ação combinada..."
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAction(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addAction}><Plus className="h-4 w-4" /></Button>
              </div>
              {actions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <button type="button" onClick={() => toggleAction(i)} className="shrink-0">
                        {a.done ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      <span className={`text-sm flex-1 ${a.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.text}</span>
                      <button type="button" onClick={() => removeAction(i)} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Remover">
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">👀 O que observar durante a semana</Label>
              <Textarea
                value={weeklyObservations}
                onChange={(e) => setWeeklyObservations(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Registre pensamentos, emoções, comportamentos, gatilhos ou situações relevantes para observar..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
