import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  UserPlus,
  Users,
  X,
  Mail,
  UserRound,
  ChevronDown,
  ChevronRight,
  Brain,
  Phone,
  Award,
  GraduationCap,
  Plus,
  Trash2,
  Check,
  Clock,
  Target,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CaseFormulation } from "@/components/app/CaseFormulation";
import { SupervisionRecords } from "@/components/app/SupervisionRecords";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Patient {
  id: string;
  full_name: string;
  is_active: boolean;
  user_id: string;
}

interface SuperviseeRow {
  id: string;
  full_name: string | null;
  crp: string | null;
  phone: string | null;
  specialty: string | null;
  avatar_url: string | null;
  patients: Patient[];
}

interface Goal {
  id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
}

const statusMap: Record<string, { label: string; icon: typeof Check; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-amber-600 bg-amber-100" },
  in_progress: { label: "Em andamento", icon: Target, color: "text-blue-600 bg-blue-100" },
  completed: { label: "Concluída", icon: Check, color: "text-emerald-600 bg-emerald-100" },
};

const Supervisees = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [supervisees, setSupervisees] = useState<SuperviseeRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tabFilter, setTabFilter] = useState<Record<string, "active" | "inactive" | "all">>({});
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Goals state
  const [goalsOpen, setGoalsOpen] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", description: "", due_date: "" });
  const [savingGoal, setSavingGoal] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, full_name, crp, phone, specialty, avatar_url")
      .eq("supervisor_id", user.id)
      .eq("profile_type", "supervisee");

    if (error) {
      toast.error("Erro ao carregar supervisionandos");
      setLoading(false);
      return;
    }

    const ids = (profs ?? []).map((p) => p.id);
    const patientsByUser: Record<string, Patient[]> = {};
    if (ids.length) {
      const { data: pats } = await supabase
        .from("patients")
        .select("id, full_name, is_active, user_id")
        .in("user_id", ids)
        .order("full_name");
      (pats ?? []).forEach((p) => {
        (patientsByUser[p.user_id] ??= []).push(p as Patient);
      });
    }

    setSupervisees(
      (profs ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        crp: p.crp,
        phone: p.phone,
        specialty: p.specialty,
        avatar_url: p.avatar_url,
        patients: patientsByUser[p.id] ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user]);

  const loadGoals = async (superviseeId: string) => {
    setGoalsLoading(true);
    const { data } = await supabase
      .from("supervisee_goals")
      .select("*")
      .eq("supervisee_id", superviseeId)
      .eq("supervisor_id", user!.id)
      .order("created_at", { ascending: false });
    setGoals((data as any) ?? []);
    setGoalsLoading(false);
  };

  const openGoals = (superviseeId: string) => {
    setGoalsOpen(superviseeId);
    loadGoals(superviseeId);
  };

  const addGoal = async () => {
    if (!newGoal.title.trim() || !goalsOpen) return;
    setSavingGoal(true);
    const { error } = await supabase.from("supervisee_goals").insert({
      supervisor_id: user!.id,
      supervisee_id: goalsOpen,
      title: newGoal.title.trim(),
      description: newGoal.description.trim(),
      due_date: newGoal.due_date || null,
    } as any);
    setSavingGoal(false);
    if (error) { toast.error("Erro ao salvar meta"); return; }
    toast.success("Meta adicionada");
    setNewGoal({ title: "", description: "", due_date: "" });
    loadGoals(goalsOpen);
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    await supabase.from("supervisee_goals").update({ status } as any).eq("id", goalId);
    if (goalsOpen) loadGoals(goalsOpen);
  };

  const deleteGoal = async (goalId: string) => {
    await supabase.from("supervisee_goals").delete().eq("id", goalId);
    if (goalsOpen) loadGoals(goalsOpen);
  };

  const handleInvite = async () => {
    const target = email.trim().toLowerCase();
    if (!target) { toast.error("Informe o email do supervisionando"); return; }
    setLinking(true);
    const { error } = await (supabase.rpc as any)("link_supervisee_by_email", { _email: target });
    setLinking(false);
    if (error) { toast.error(error.message || "Não foi possível vincular"); return; }
    setEmail("");
    toast.success("Supervisionando vinculado");
    load();
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const { error } = await (supabase.rpc as any)("unlink_supervisee", { _supervisee_id: id });
    setRemovingId(null);
    if (error) { toast.error("Erro ao remover vínculo"); return; }
    toast.success("Vínculo removido");
    setSupervisees((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const filterPatients = (list: Patient[], f: "active" | "inactive" | "all") =>
    list.filter((p) => (f === "all" ? true : f === "active" ? p.is_active : !p.is_active));

  const getInitials = (name: string) => {
    const parts = (name || "").trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] ?? "?").toUpperCase();
  };

  return (
    <div className="space-y-8 animate-fade-up max-w-4xl">
      <header>
        <h1 className="font-display text-4xl font-medium">Supervisionandos</h1>
        <p className="mt-2 text-muted-foreground">
          Gerencie os profissionais que você supervisiona e consulte os pacientes vinculados a cada um.
        </p>
      </header>

      {/* Invite section */}
      <section className="rounded-3xl bg-card border border-border shadow-card p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Convidar supervisionando</h2>
            <p className="text-xs text-muted-foreground">
              O profissional já deve ter conta criada e perfil definido como Supervisionando.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite_email">Email</Label>
          <div className="flex gap-2">
            <Input
              id="invite_email"
              type="email"
              placeholder="supervisionando@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <Button onClick={handleInvite} disabled={linking || !email}>
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Vincular
            </Button>
          </div>
        </div>
      </section>

      {/* Supervisees list */}
      <section className="rounded-3xl bg-card border border-border shadow-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Meus supervisionandos</h2>
              <p className="text-xs text-muted-foreground">
                {supervisees.length} {supervisees.length === 1 ? "vínculo ativo" : "vínculos ativos"}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : supervisees.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhum supervisionando vinculado ainda.
          </div>
        ) : (
          <ul className="space-y-4">
            {supervisees.map((s) => {
              const isOpen = !!expanded[s.id];
              const f = tabFilter[s.id] ?? "active";
              const activeCount = s.patients.filter((p) => p.is_active).length;
              const inactiveCount = s.patients.length - activeCount;
              const visible = filterPatients(s.patients, f);

              return (
                <li key={s.id} className="rounded-2xl bg-secondary/30 border border-border overflow-hidden">
                  {/* ── Profile Card ── */}
                  <div className="p-5 flex items-start gap-4">
                    {/* Avatar */}
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={s.full_name || ""}
                        className="h-16 w-16 rounded-full object-cover border-2 border-accent/30 shrink-0"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shrink-0 text-xl font-bold font-display">
                        {getInitials(s.full_name || "")}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg font-semibold truncate">
                        {s.full_name || "Sem nome"}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        {s.crp && (
                          <span className="flex items-center gap-1">
                            <Award className="h-3.5 w-3.5" /> CRP {s.crp}
                          </span>
                        )}
                        {s.specialty && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3.5 w-3.5" /> {s.specialty}
                          </span>
                        )}
                        {s.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {s.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activeCount} {activeCount === 1 ? "paciente ativo" : "pacientes ativos"} · {inactiveCount} {inactiveCount === 1 ? "inativo" : "inativos"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openGoals(s.id)}>
                        <Target className="h-3.5 w-3.5 mr-1" /> Metas
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(s.id)}>
                        {isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                        Pacientes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(s.id)}
                        disabled={removingId === s.id}
                      >
                        {removingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                        Remover
                      </Button>
                    </div>
                  </div>

                  {/* ── Supervision Records ── */}
                  <div className="px-5 py-4 border-t border-border/60 bg-background/40">
                    <SupervisionRecords
                      supervisorId={user!.id}
                      superviseeId={s.id}
                      superviseeName={s.full_name || "Supervisionando"}
                    />
                  </div>

                  {/* ── Patients list ── */}
                  {isOpen && (
                    <div className="px-5 pb-5 space-y-3 border-t border-border/60 pt-4 bg-background/40">
                      {s.patients.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Este supervisionando ainda não tem pacientes cadastrados.
                        </p>
                      ) : (
                        <>
                          <Tabs
                            value={f}
                            onValueChange={(v) =>
                              setTabFilter((prev) => ({ ...prev, [s.id]: v as typeof f }))
                            }
                          >
                            <TabsList>
                              <TabsTrigger value="active">Ativos ({activeCount})</TabsTrigger>
                              <TabsTrigger value="inactive">Inativos ({inactiveCount})</TabsTrigger>
                              <TabsTrigger value="all">Todos ({s.patients.length})</TabsTrigger>
                            </TabsList>
                          </Tabs>

                          {visible.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Nenhum paciente neste filtro.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {visible.map((p) => (
                                <li key={p.id}>
                                  <button
                                    onClick={() => setSelectedPatient(p)}
                                    className="w-full flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-3 hover:border-primary hover:shadow-soft transition-all text-left"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary font-display shrink-0">
                                        {p.full_name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium truncate">{p.full_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {p.is_active ? (
                                            <span className="text-primary-glow">● Ativo</span>
                                          ) : (
                                            <span>○ Inativo</span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Patient detail dialog (read-only clinical) */}
      <Dialog open={!!selectedPatient} onOpenChange={(o) => !o && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selectedPatient?.full_name}
            </DialogTitle>
            <DialogDescription>
              {selectedPatient?.is_active ? "Paciente ativo" : "Paciente inativo"} · acesso somente leitura
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <CaseFormulation patientId={selectedPatient.id} readOnly />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Goals dialog */}
      <Dialog open={!!goalsOpen} onOpenChange={(o) => !o && setGoalsOpen(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Target className="h-5 w-5 text-accent" />
              Plano de Metas
            </DialogTitle>
            <DialogDescription>
              Metas de desenvolvimento para {supervisees.find((s) => s.id === goalsOpen)?.full_name}
            </DialogDescription>
          </DialogHeader>

          {/* Add new goal */}
          <div className="space-y-3 rounded-xl bg-secondary/40 p-4 border border-border">
            <p className="text-sm font-semibold text-foreground">Nova meta</p>
            <Input
              placeholder="Título da meta"
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
            />
            <Textarea
              placeholder="Descrição (opcional)"
              rows={2}
              value={newGoal.description}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Prazo:</Label>
              <Input
                type="date"
                className="w-40"
                value={newGoal.due_date}
                onChange={(e) => setNewGoal({ ...newGoal, due_date: e.target.value })}
              />
              <div className="flex-1" />
              <Button variant="accent" size="sm" onClick={addGoal} disabled={savingGoal || !newGoal.title.trim()}>
                {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
              </Button>
            </div>
          </div>

          {/* Goals list */}
          {goalsLoading ? (
            <div className="text-center py-6">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
            </div>
          ) : goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma meta cadastrada ainda. Crie a primeira acima ✨
            </p>
          ) : (
            <ul className="space-y-2">
              {goals.map((g) => {
                const st = statusMap[g.status] ?? statusMap.pending;
                const StIcon = st.icon;
                return (
                  <li key={g.id} className="rounded-xl bg-card border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{g.title}</p>
                        {g.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{g.description}</p>
                        )}
                        {g.due_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Prazo: {format(new Date(g.due_date + "T12:00:00"), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                        onClick={() => deleteGoal(g.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(["pending", "in_progress", "completed"] as const).map((st2) => {
                        const cfg = statusMap[st2];
                        const active = g.status === st2;
                        return (
                          <button
                            key={st2}
                            onClick={() => updateGoalStatus(g.id, st2)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                              active ? cfg.color : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Supervisees;
