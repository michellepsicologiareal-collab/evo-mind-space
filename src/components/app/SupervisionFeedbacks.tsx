import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Lightbulb,
  MessageSquareQuote,
  X,
  GraduationCap,
  CheckCheck,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface SupervisionFeedback {
  id: string;
  supervisor_id: string;
  supervisee_id: string;
  patient_id: string;
  supervision_date: string;
  case_synthesis: string;
  conceptualization: string;
  maintenance_cycle: string;
  clinical_hypotheses: string;
  therapeutic_direction: string;
  suggested_interventions: string[];
  next_session_points: string[];
  reflection_questions: string[];
  next_supervision_attention: string;
  shared_with_supervisee: boolean;
  read_at: string | null;
  created_at: string;
}

const emptyForm = () => ({
  supervision_date: new Date().toISOString().split("T")[0],
  case_synthesis: "",
  conceptualization: "",
  maintenance_cycle: "",
  clinical_hypotheses: "",
  therapeutic_direction: "",
  suggested_interventions: [] as string[],
  next_session_points: [] as string[],
  reflection_questions: [] as string[],
  next_supervision_attention: "",
  shared_with_supervisee: false,
});

type FormState = ReturnType<typeof emptyForm>;

interface ListEditorProps {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}

function ListEditor({ label, placeholder, items, onChange }: ListEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" size="icon" className="shrink-0" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li
              key={`${it}-${i}`}
              className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1 break-words">{it}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VisibilityBadge({ shared }: { shared: boolean }) {
  return shared ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-moss/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss">
      <Eye className="h-3 w-3" /> Compartilhada
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <EyeOff className="h-3 w-3" /> Somente supervisor
    </span>
  );
}

function ReadStatusBadge({ readAt }: { readAt: string | null }) {
  return readAt ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      <CheckCheck className="h-3 w-3" /> Lida em {format(new Date(readAt), "dd/MM/yyyy HH:mm")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
      <Clock className="h-3 w-3" /> Não lida
    </span>
  );
}

function ReadBlock({ title, value }: { title: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

function ReadList({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  patientId: string;
  superviseeId: string;
  patientLabel: string;
  /** true when the current user is the supervisor (can create/edit) */
  canManage?: boolean;
}

export function SupervisionFeedbacks({
  patientId,
  superviseeId,
  patientLabel,
  canManage = true,
}: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<SupervisionFeedback[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [viewing, setViewing] = useState<SupervisionFeedback | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("supervision_feedbacks")
      .select("*")
      .eq("patient_id", patientId)
      .order("supervision_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar devolutivas");
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as SupervisionFeedback[];
    setItems(rows);

    const ids = Array.from(new Set(rows.map((r) => r.supervisor_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.id] = p.full_name ?? "Supervisor(a)";
      });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const openView = async (f: SupervisionFeedback) => {
    setViewing(f);
    // supervisee reading a shared feedback marks it as read
    if (
      user &&
      f.shared_with_supervisee &&
      !f.read_at &&
      f.supervisee_id === user.id &&
      f.supervisor_id !== user.id
    ) {
      const { data } = await (supabase as any).rpc("mark_supervision_feedback_read", { _id: f.id });
      if (data) {
        const readAt = data as string;
        setViewing((prev) => (prev && prev.id === f.id ? { ...prev, read_at: readAt } : prev));
        setItems((prev) => prev.map((it) => (it.id === f.id ? { ...it, read_at: readAt } : it)));
      }
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (f: SupervisionFeedback) => {
    setEditingId(f.id);
    setForm({
      supervision_date: f.supervision_date,
      case_synthesis: f.case_synthesis ?? "",
      conceptualization: f.conceptualization ?? "",
      maintenance_cycle: f.maintenance_cycle ?? "",
      clinical_hypotheses: f.clinical_hypotheses ?? "",
      therapeutic_direction: f.therapeutic_direction ?? "",
      suggested_interventions: f.suggested_interventions ?? [],
      next_session_points: f.next_session_points ?? [],
      reflection_questions: f.reflection_questions ?? [],
      next_supervision_attention: f.next_supervision_attention ?? "",
      shared_with_supervisee: f.shared_with_supervisee,
    });
    setViewing(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { ...form };
    let error;
    if (editingId) {
      ({ error } = await (supabase as any)
        .from("supervision_feedbacks")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await (supabase as any).from("supervision_feedbacks").insert({
        ...payload,
        supervisor_id: user.id,
        supervisee_id: superviseeId,
        patient_id: patientId,
      }));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao salvar devolutiva");
      return;
    }
    toast.success(editingId ? "Devolutiva atualizada" : "Devolutiva registrada");
    setFormOpen(false);
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("supervision_feedbacks").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Devolutiva excluída");
    setViewing(null);
    load();
  };

  const summaryOf = (f: SupervisionFeedback) =>
    (f.case_synthesis || f.conceptualization || f.therapeutic_direction || "").trim();

  return (
    <section className="rounded-2xl border-2 border-dashed border-lilac/50 bg-lilac/5 p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-lilac" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Devolutivas da Supervisão</h3>
            <p className="text-xs text-muted-foreground">
              Orientação clínica do supervisor — não altera o prontuário nem os registros do
              supervisionando.
            </p>
          </div>
        </div>
        {canManage && (
          <Button variant="accent" size="sm" className="shrink-0 w-full sm:w-auto" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova devolutiva
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-4 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-card/70 p-3 text-sm text-muted-foreground">
          Nenhuma devolutiva registrada para {patientLabel} ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {format(new Date(f.supervision_date + "T12:00:00"), "dd 'de' MMM yyyy", {
                    locale: ptBR,
                  })}
                </span>
                <VisibilityBadge shared={f.shared_with_supervisee} />
                {f.shared_with_supervisee && <ReadStatusBadge readAt={f.read_at} />}
                <span className="text-xs text-muted-foreground">
                  {names[f.supervisor_id] ?? "Supervisor(a)"}
                </span>
              </div>
              {summaryOf(f) && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{summaryOf(f)}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => openView(f)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver devolutiva completa
                </Button>
                {canManage && f.supervisor_id === user?.id && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => remove(f.id)}
                      aria-label="Excluir devolutiva"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-lilac" />
              {editingId ? "Editar devolutiva" : "Nova devolutiva"}
            </DialogTitle>
            <DialogDescription>Devolutiva de supervisão sobre {patientLabel}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sup_date">Data da supervisão</Label>
              <Input
                id="sup_date"
                type="date"
                value={form.supervision_date}
                onChange={(e) => setForm((p) => ({ ...p, supervision_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="synthesis">Síntese do caso / ponto trazido para supervisão</Label>
              <Textarea
                id="synthesis"
                rows={3}
                value={form.case_synthesis}
                onChange={(e) => setForm((p) => ({ ...p, case_synthesis: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conceptualization">Leitura e conceitualização clínica</Label>
              <Textarea
                id="conceptualization"
                rows={5}
                value={form.conceptualization}
                onChange={(e) => setForm((p) => ({ ...p, conceptualization: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cycle">Ciclo de manutenção</Label>
              <Textarea
                id="cycle"
                rows={5}
                placeholder="Formulação funcional / cognitivo-comportamental"
                value={form.maintenance_cycle}
                onChange={(e) => setForm((p) => ({ ...p, maintenance_cycle: e.target.value }))}
              />
            </div>

            <div className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:bg-amber-950/20">
              <Label htmlFor="hypotheses" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                Hipóteses clínicas a investigar
              </Label>
              <p className="text-xs text-muted-foreground">
                São hipóteses de trabalho para investigação — não constituem conclusão ou diagnóstico.
              </p>
              <Textarea
                id="hypotheses"
                rows={4}
                value={form.clinical_hypotheses}
                onChange={(e) => setForm((p) => ({ ...p, clinical_hypotheses: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Direcionamento terapêutico</Label>
              <Textarea
                id="direction"
                rows={5}
                placeholder="Prioridades e estratégias sugeridas para a condução do caso"
                value={form.therapeutic_direction}
                onChange={(e) => setForm((p) => ({ ...p, therapeutic_direction: e.target.value }))}
              />
            </div>

            <ListEditor
              label="Intervenções sugeridas"
              placeholder="Adicionar intervenção"
              items={form.suggested_interventions}
              onChange={(v) => setForm((p) => ({ ...p, suggested_interventions: v }))}
            />

            <ListEditor
              label="Pontos para investigar na próxima sessão"
              placeholder="Adicionar ponto"
              items={form.next_session_points}
              onChange={(v) => setForm((p) => ({ ...p, next_session_points: v }))}
            />

            <ListEditor
              label="Perguntas para reflexão do supervisionando"
              placeholder="Adicionar pergunta"
              items={form.reflection_questions}
              onChange={(v) => setForm((p) => ({ ...p, reflection_questions: v }))}
            />

            <div className="space-y-2">
              <Label htmlFor="attention">Atenção para a próxima supervisão</Label>
              <Textarea
                id="attention"
                rows={3}
                value={form.next_supervision_attention}
                onChange={(e) =>
                  setForm((p) => ({ ...p, next_supervision_attention: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
              <Label>Visibilidade da devolutiva</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { v: true, label: "Compartilhar com supervisionando", icon: Eye },
                  { v: false, label: "Somente supervisor", icon: EyeOff },
                ].map(({ v, label, icon: Icon }) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, shared_with_supervisee: v }))}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      form.shared_with_supervisee === v
                        ? "border-primary bg-card font-medium text-foreground"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                O supervisionando nunca poderá editar esta devolutiva.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? "Salvar alterações" : "Salvar devolutiva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <MessageSquareQuote className="h-5 w-5 text-lilac" />
                  Devolutiva da Supervisão
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(viewing.supervision_date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}{" "}
                  · {names[viewing.supervisor_id] ?? "Supervisor(a)"} · {patientLabel}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <VisibilityBadge shared={viewing.shared_with_supervisee} />
                  {viewing.shared_with_supervisee && <ReadStatusBadge readAt={viewing.read_at} />}
                </div>
                <ReadBlock title="Síntese do caso" value={viewing.case_synthesis} />
                <ReadBlock title="Leitura e conceitualização clínica" value={viewing.conceptualization} />
                <ReadBlock title="Ciclo de manutenção" value={viewing.maintenance_cycle} />
                {viewing.clinical_hypotheses?.trim() && (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:bg-amber-950/20">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      <Lightbulb className="h-3.5 w-3.5" /> Hipóteses a investigar (não são conclusões
                      diagnósticas)
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{viewing.clinical_hypotheses}</p>
                  </div>
                )}
                <ReadBlock title="Direcionamento terapêutico" value={viewing.therapeutic_direction} />
                <ReadList title="Intervenções sugeridas" items={viewing.suggested_interventions} />
                <ReadList
                  title="Pontos para investigar na próxima sessão"
                  items={viewing.next_session_points}
                />
                <ReadList
                  title="Perguntas para reflexão do supervisionando"
                  items={viewing.reflection_questions}
                />
                <ReadBlock
                  title="Atenção para a próxima supervisão"
                  value={viewing.next_supervision_attention}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  Fechar
                </Button>
                {canManage && viewing.supervisor_id === user?.id && (
                  <Button variant="accent" onClick={() => openEdit(viewing)}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
