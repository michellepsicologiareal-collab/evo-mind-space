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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CaseFormulation } from "@/components/app/CaseFormulation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  session_price: number | null;
  user_id: string;
}

interface SuperviseeRow {
  id: string;
  full_name: string | null;
  patients: Patient[];
}

interface SessionSummary {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
}

interface ProgressEntry {
  id: string;
  recorded_at: string;
  mood_score: number | null;
  note: string | null;
}

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
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [latestProgress, setLatestProgress] = useState<ProgressEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedPatient) {
      setRecentSessions([]);
      setLatestProgress(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      const [sRes, pRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, scheduled_at, status, notes")
          .eq("patient_id", selectedPatient.id)
          .order("scheduled_at", { ascending: false })
          .limit(3),
        (supabase as any)
          .from("patient_progress")
          .select("id, recorded_at, mood_score, note")
          .eq("patient_id", selectedPatient.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setRecentSessions((sRes.data as SessionSummary[]) ?? []);
      setLatestProgress((pRes.data as ProgressEntry | null) ?? null);
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, full_name")
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
        .select("id, full_name, email, phone, notes, is_active, session_price, user_id")
        .in("user_id", ids)
        .order("full_name");
      (pats ?? []).forEach((p) => {
        (patientsByUser[p.user_id] ??= []).push(p as Patient);
      });
    }

    setSupervisees(
      (profs ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        patients: patientsByUser[p.id] ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user]);

  const handleInvite = async () => {
    const target = email.trim().toLowerCase();
    if (!target) {
      toast.error("Informe o email do supervisionando");
      return;
    }
    setLinking(true);
    const { error } = await (supabase.rpc as any)("link_supervisee_by_email", {
      _email: target,
    });
    setLinking(false);
    if (error) {
      toast.error(error.message || "Não foi possível vincular");
      return;
    }
    setEmail("");
    toast.success("Supervisionando vinculado");
    load();
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const { error } = await (supabase.rpc as any)("unlink_supervisee", {
      _supervisee_id: id,
    });
    setRemovingId(null);
    if (error) {
      toast.error("Erro ao remover vínculo");
      return;
    }
    toast.success("Vínculo removido");
    setSupervisees((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const filterPatients = (list: Patient[], f: "active" | "inactive" | "all") =>
    list.filter((p) => (f === "all" ? true : f === "active" ? p.is_active : !p.is_active));

  return (
    <div className="space-y-8 animate-fade-up max-w-3xl">
      <header>
        <h1 className="font-display text-4xl font-medium">Supervisionandos</h1>
        <p className="mt-2 text-muted-foreground">
          Gerencie os profissionais que você supervisiona e consulte os pacientes vinculados a cada um.
        </p>
      </header>

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
          <ul className="space-y-3">
            {supervisees.map((s) => {
              const isOpen = !!expanded[s.id];
              const f = tabFilter[s.id] ?? "active";
              const activeCount = s.patients.filter((p) => p.is_active).length;
              const inactiveCount = s.patients.length - activeCount;
              const visible = filterPatients(s.patients, f);

              return (
                <li key={s.id} className="rounded-xl bg-secondary/40 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button
                      onClick={() => toggleExpand(s.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shrink-0">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">
                          {s.full_name || "Sem nome"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeCount} {activeCount === 1 ? "ativo" : "ativos"} · {inactiveCount} {inactiveCount === 1 ? "inativo" : "inativos"}
                        </p>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleRemove(s.id)}
                      disabled={removingId === s.id}
                    >
                      {removingId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      Remover
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-4 bg-background/40">
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

      <Dialog open={!!selectedPatient} onOpenChange={(o) => !o && setSelectedPatient(null)}>
        <DialogContent className="max-w-lg">
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
    </div>
  );
};

export default Supervisees;
