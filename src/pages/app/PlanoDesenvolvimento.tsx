import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  GraduationCap,
  Plus,
  Trash2,
  Share2,
  Copy,
  Link2Off,
  Check,
  Clock,
  Target,
  MessageSquare,
  Save,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/PageHeader";

interface Supervisee {
  id: string;
  full_name: string | null;
}

interface Activity {
  text: string;
  done: boolean;
}

interface DevPlan {
  id: string;
  supervisee_id: string;
  title: string;
  skill: string | null;
  evidence: string | null;
  objective: string | null;
  activities: Activity[] | null;
  materials: string | null;
  supervisor_feedback: string | null;
  supervisee_reflection: string | null;
  supervisee_feedback: string | null;
  supervisee_updated_at: string | null;
  status: string;
  due_date: string | null;
  share_token: string | null;
  share_password: string | null;
  share_expires_at: string | null;
  share_revoked_at: string | null;
  updated_at: string;
}

const statusMap: Record<string, { label: string; icon: typeof Check; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-amber-700 bg-amber-100" },
  in_progress: { label: "Em andamento", icon: Target, color: "text-blue-700 bg-blue-100" },
  completed: { label: "Concluído", icon: Check, color: "text-emerald-700 bg-emerald-100" },
};

const emptyForm = {
  title: "",
  skill: "",
  evidence: "",
  objective: "",
  activitiesText: "",
  materials: "",
  supervisor_feedback: "",
  status: "pending",
  due_date: "",
};

const PlanoDesenvolvimento = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [supervisees, setSupervisees] = useState<Supervisee[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [plans, setPlans] = useState<DevPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editing, setEditing] = useState<DevPlan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [shareFor, setShareFor] = useState<DevPlan | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [sharing, setSharing] = useState(false);

  const loadSupervisees = async () => {
    const { data, error } = await (supabase as any).rpc("list_my_supervisees");
    if (error) {
      toast.error("Erro ao carregar supervisionandos");
      setLoading(false);
      return;
    }
    const list = (data ?? []).map((p: any) => ({ id: p.id, full_name: p.full_name }));
    setSupervisees(list);
    if (list.length && !selected) setSelected(list[0].id);
    setLoading(false);
  };

  const loadPlans = async (superviseeId: string) => {
    if (!superviseeId || !user) return;
    setPlansLoading(true);
    const { data } = await (supabase as any)
      .from("supervisee_goals")
      .select("*")
      .eq("supervisee_id", superviseeId)
      .eq("supervisor_id", user.id)
      .order("created_at", { ascending: false });
    setPlans((data as DevPlan[]) ?? []);
    setPlansLoading(false);
  };

  useEffect(() => {
    loadSupervisees();
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (selected) loadPlans(selected);
    // eslint-disable-next-line
  }, [selected]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: DevPlan) => {
    setEditing(p);
    setForm({
      title: p.title ?? "",
      skill: p.skill ?? "",
      evidence: p.evidence ?? "",
      objective: p.objective ?? "",
      activitiesText: (p.activities ?? []).map((a) => a.text).join("\n"),
      materials: p.materials ?? "",
      supervisor_feedback: p.supervisor_feedback ?? "",
      status: p.status ?? "pending",
      due_date: p.due_date ?? "",
    });
    setDialogOpen(true);
  };

  const savePlan = async () => {
    if (!form.title.trim() || !selected || !user) {
      toast.error("Informe um título para o plano");
      return;
    }
    setSaving(true);

    const previous = editing?.activities ?? [];
    const activities: Activity[] = form.activitiesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((text) => ({
        text,
        done: previous.find((a) => a.text === text)?.done ?? false,
      }));

    const payload = {
      supervisor_id: user.id,
      supervisee_id: selected,
      title: form.title.trim(),
      skill: form.skill.trim() || null,
      evidence: form.evidence.trim() || null,
      objective: form.objective.trim() || null,
      activities,
      materials: form.materials.trim() || null,
      supervisor_feedback: form.supervisor_feedback.trim() || null,
      status: form.status,
      due_date: form.due_date || null,
    };

    const { error } = editing
      ? await (supabase as any).from("supervisee_goals").update(payload).eq("id", editing.id)
      : await (supabase as any).from("supervisee_goals").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar o plano");
      return;
    }
    toast.success(editing ? "Plano atualizado" : "Plano criado");
    setDialogOpen(false);
    loadPlans(selected);
  };

  const removePlan = async (id: string) => {
    await (supabase as any).from("supervisee_goals").delete().eq("id", id);
    toast.success("Plano removido");
    loadPlans(selected);
  };

  const publicUrl = (token: string) => `${window.location.origin}/plano-supervisao/${token}`;

  const createShare = async () => {
    if (!shareFor) return;
    setSharing(true);
    const token = shareFor.share_token ?? crypto.randomUUID();
    const { error } = await (supabase as any)
      .from("supervisee_goals")
      .update({
        share_token: token,
        share_password: sharePassword.trim() || null,
        share_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        share_revoked_at: null,
      })
      .eq("id", shareFor.id);
    setSharing(false);
    if (error) {
      toast.error("Não foi possível gerar o link");
      return;
    }
    await navigator.clipboard.writeText(publicUrl(token)).catch(() => {});
    toast.success("Link gerado e copiado");
    setShareFor(null);
    setSharePassword("");
    loadPlans(selected);
  };

  const revokeShare = async (p: DevPlan) => {
    await (supabase as any)
      .from("supervisee_goals")
      .update({ share_revoked_at: new Date().toISOString() })
      .eq("id", p.id);
    toast.success("Link revogado");
    loadPlans(selected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up max-w-5xl">
      <PageHeader
        icon={GraduationCap}
        title="Plano de Desenvolvimento"
        subtitle="Construa planos de competências para seus supervisionandos a partir de evidências observadas."
        intro="Este plano é sobre o desenvolvimento profissional do supervisionando — nenhum dado de paciente é exibido ou compartilhado aqui."
      />

      {supervisees.length === 0 ? (
        <div className="rounded-3xl bg-card border border-border shadow-card p-8 text-center text-sm text-muted-foreground">
          Vincule um supervisionando na área de Supervisão para criar planos de desenvolvimento.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {supervisees.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selected === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s.full_name || "Sem nome"}
              </button>
            ))}
            <Button className="ml-auto" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo plano
            </Button>
          </div>

          <section className="space-y-4">
            {plansLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-3xl bg-card border border-border shadow-card p-8 text-center text-sm text-muted-foreground">
                Nenhum plano de desenvolvimento ainda. Comece registrando uma competência a desenvolver.
              </div>
            ) : (
              plans.map((p) => {
                const st = statusMap[p.status] ?? statusMap.pending;
                const StIcon = st.icon;
                const acts = p.activities ?? [];
                const done = acts.filter((a) => a.done).length;
                const linkActive = !!p.share_token && !p.share_revoked_at;
                return (
                  <article
                    key={p.id}
                    className="rounded-2xl bg-card border border-border shadow-card p-5 space-y-4"
                  >
                    <header className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-semibold">{p.title}</h2>
                        {p.skill && (
                          <p className="text-xs text-muted-foreground">Competência: {p.skill}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.color}`}>
                          <StIcon className="h-3 w-3" /> {st.label}
                        </span>
                        {p.due_date && (
                          <span className="text-[11px] text-muted-foreground">
                            Prazo: {format(new Date(`${p.due_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      {p.evidence && (
                        <div className="rounded-xl bg-secondary/40 p-3">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Evidências observadas</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">{p.evidence}</p>
                        </div>
                      )}
                      {p.objective && (
                        <div className="rounded-xl bg-secondary/40 p-3">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Objetivo de desenvolvimento</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">{p.objective}</p>
                        </div>
                      )}
                      {p.materials && (
                        <div className="rounded-xl bg-secondary/40 p-3">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Materiais / orientações</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">{p.materials}</p>
                        </div>
                      )}
                      {p.supervisor_feedback && (
                        <div className="rounded-xl bg-secondary/40 p-3">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Feedback do supervisor</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">{p.supervisor_feedback}</p>
                        </div>
                      )}
                    </div>

                    {acts.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                          Atividades práticas · {done}/{acts.length} concluídas
                        </p>
                        <ul className="space-y-1 text-sm">
                          {acts.map((a, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className={`h-4 w-4 mt-0.5 shrink-0 ${a.done ? "text-emerald-600" : "text-muted-foreground/30"}`} />
                              <span className={a.done ? "line-through text-muted-foreground" : ""}>{a.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(p.supervisee_reflection || p.supervisee_feedback) && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5 text-sm">
                        <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-primary">
                          <MessageSquare className="h-3.5 w-3.5" /> Retorno do supervisionando
                          {p.supervisee_updated_at && (
                            <span className="ml-auto normal-case text-muted-foreground font-normal">
                              {format(new Date(p.supervisee_updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </p>
                        {p.supervisee_reflection && (
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            <span className="font-medium text-foreground">Reflexões e dificuldades: </span>
                            {p.supervisee_reflection}
                          </p>
                        )}
                        {p.supervisee_feedback && (
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            <span className="font-medium text-foreground">Devolutiva: </span>
                            {p.supervisee_feedback}
                          </p>
                        )}
                      </div>
                    )}

                    <footer className="flex flex-wrap items-center gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        <Save className="h-4 w-4" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setShareFor(p);
                          setSharePassword(p.share_password ?? "");
                        }}
                      >
                        <Share2 className="h-4 w-4" /> Compartilhar plano
                      </Button>
                      {linkActive && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(publicUrl(p.share_token!));
                              toast.success("Link copiado");
                            }}
                          >
                            <Copy className="h-4 w-4" /> Copiar link
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => revokeShare(p)}>
                            <Link2Off className="h-4 w-4" /> Revogar
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-destructive"
                        onClick={() => removePlan(p.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </Button>
                    </footer>
                  </article>
                );
              })
            )}
          </section>
        </>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? "Editar plano de desenvolvimento" : "Novo plano de desenvolvimento"}
            </DialogTitle>
            <DialogDescription>
              Registre apenas informações sobre a prática do supervisionando — sem dados de pacientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título do plano</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Habilidade ou competência a desenvolver</Label>
              <Input value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Evidências e situações observadas</Label>
              <Textarea rows={3} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo de desenvolvimento</Label>
              <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Atividades práticas (uma por linha)</Label>
              <Textarea
                rows={4}
                value={form.activitiesText}
                onChange={(e) => setForm({ ...form, activitiesText: e.target.value })}
                placeholder={"Gravar e revisar uma sessão\nLer capítulo sobre conceitualização"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Materiais ou orientações</Label>
              <Textarea rows={2} value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Feedback do supervisor</Label>
              <Textarea rows={3} value={form.supervisor_feedback} onChange={(e) => setForm({ ...form, supervisor_feedback: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={!!shareFor} onOpenChange={(o) => { if (!o) { setShareFor(null); setSharePassword(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Compartilhar plano</DialogTitle>
            <DialogDescription>
              Gera um link individual, com validade de 90 dias e revogável a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Senha (opcional)</Label>
              <Input
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder="Defina uma senha para proteger o link"
              />
            </div>
            {shareFor?.share_token && !shareFor.share_revoked_at && (
              <p className="text-xs text-muted-foreground break-all rounded-lg bg-secondary/40 p-2">
                {publicUrl(shareFor.share_token)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareFor(null)}>Cancelar</Button>
            <Button onClick={createShare} disabled={sharing}>
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Gerar e copiar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanoDesenvolvimento;
