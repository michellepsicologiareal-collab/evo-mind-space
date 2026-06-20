import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Send, Trash2, Download, MessageCircle, FileText, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  sent_at: string | null;
  created_at: string;
  session_record_id: string | null;
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
  const [content, setContent] = useState("");
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

  const resetForm = () => { setTitle(""); setContent(""); setSourceRecord("none"); setEditing(null); };

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (t: Task) => {
    setEditing(t);
    setTitle(t.title);
    setContent(t.content);
    setSourceRecord(t.session_record_id ?? "none");
    setOpen(true);
  };

  const fillFromRecord = (recordId: string) => {
    setSourceRecord(recordId);
    if (recordId === "none") return;
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    const parts = [rec.next_session_plan, rec.clinical_observations].filter(Boolean).join("\n\n");
    if (parts) setContent(parts);
    if (!title) setTitle(`Tarefa da sessão de ${format(new Date(rec.session_date), "dd/MM/yyyy")}`);
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Preencha título e conteúdo"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      title: title.trim(),
      content: content.trim(),
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
    toast.success(editing ? "Tarefa atualizada" : "Tarefa criada");
    setOpen(false);
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("homework_tasks").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Tarefa excluída");
    load();
  };

  const sendWhats = async (task: Task) => {
    const digits = normalizePhoneForWhatsApp(patientPhone);
    if (!digits) { toast.error("Paciente sem WhatsApp cadastrado"); return; }
    if (!publicUrl) { toast.error("Token público indisponível"); return; }
    const firstName = patientName.split(" ")[0];
    const psiName = therapistFirstName || "sua psi";
    const msg = [
      `Olá, ${firstName}! Aqui é a ${psiName}.`,
      "",
      `Segue sua tarefa de casa: *${task.title}*`,
      "",
      `Você pode acompanhar todas as tarefas pelo link abaixo (também gera PDF):`,
      publicUrl,
      "",
      "Qualquer dúvida, estou por aqui.",
    ].join("\n");
    // Mark as sent (if not already)
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
          <Button variant="accent" size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Nova tarefa</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma tarefa de casa criada ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie tarefas a partir do que anotou no registro de sessão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-semibold text-foreground">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Criada {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    {t.sent_at && ` · Enviada ${format(new Date(t.sent_at), "dd/MM/yyyy", { locale: ptBR })}`}
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
              <p className="text-sm text-foreground whitespace-pre-line">{t.content}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar tarefa" : "Nova tarefa de casa"}</DialogTitle>
            <DialogDescription>Para {patientName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {records.length > 0 && !editing && (
              <div>
                <Label className="text-xs">Preencher a partir de um registro de sessão (opcional)</Label>
                <Select value={sourceRecord} onValueChange={fillFromRecord}>
                  <SelectTrigger><SelectValue placeholder="Escolher registro..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Tarefa livre —</SelectItem>
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
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Registro de pensamentos da semana" maxLength={200} />
            </div>
            <div>
              <Label className="text-xs">Conteúdo da tarefa</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} maxLength={4000} placeholder="Descreva a tarefa que o paciente deve realizar até a próxima sessão..." />
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
