import { useEffect, useState } from "react";
import { logSupervisionAccess } from "@/utils/auditLog";
import michellePhoto from "@/assets/michelle-photo.png";
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
  Phone,
  StickyNote,
  CalendarDays,
  Smile,
  Activity,
  Eye,
  MapPin,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/app/PageHeader";

interface PatientListItem {
  id: string;
  initials: string;
  is_active: boolean;
  user_id: string;
}

interface PatientDetail {
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
  patients: PatientListItem[];
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

const Supervision = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileType, setProfileType] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [supervisees, setSupervisees] = useState<SuperviseeRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tabFilter, setTabFilter] = useState<Record<string, "active" | "inactive" | "all">>({});
  const [selectedPatientItem, setSelectedPatientItem] = useState<PatientListItem | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [latestProgress, setLatestProgress] = useState<ProgressEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openPatientDetail = async (item: PatientListItem) => {
    setSelectedPatientItem(item);
    setSelectedPatient(null);
    setDetailLoading(true);
    setRecentSessions([]);
    setLatestProgress(null);

    const [patRes, sRes, pRes] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, email, phone, notes, is_active, session_price, user_id")
        .eq("id", item.id)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id, scheduled_at, status, notes")
        .eq("patient_id", item.id)
        .order("scheduled_at", { ascending: false })
        .limit(5),
      (supabase as any)
        .from("patient_progress")
        .select("id, recorded_at, mood_score, note")
        .eq("patient_id", item.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setSelectedPatient(patRes.data as PatientDetail | null);
    setRecentSessions((sRes.data as SessionSummary[]) ?? []);
    setLatestProgress((pRes.data as ProgressEntry | null) ?? null);
    setDetailLoading(false);

    if (item.user_id) {
      logSupervisionAccess("patient", item.id, item.user_id, item.id);
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Check profile type first
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("profile_type")
      .eq("id", user.id)
      .maybeSingle();
    const pt = myProfile?.profile_type ?? "standard";
    setProfileType(pt);

    if (pt !== "supervisor") {
      setLoading(false);
      return;
    }

    const { data: profs, error } = await (supabase as any).rpc("list_my_supervisees");

    if (error) {
      toast.error("Erro ao carregar supervisionandos");
      setLoading(false);
      return;
    }

    const ids = (profs ?? []).map((p) => p.id);
    const patientsByUser: Record<string, PatientListItem[]> = {};
    if (ids.length) {
      const { data: pats } = await supabase
        .from("patients")
        .select("id, full_name, is_active, user_id")
        .in("user_id", ids)
        .order("full_name");
      (pats ?? []).forEach((p: any) => {
        const parts = (p.full_name || "").trim().split(/\s+/);
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : (parts[0]?.[0] ?? "?").toUpperCase();
        (patientsByUser[p.user_id] ??= []).push({
          id: p.id,
          initials,
          is_active: p.is_active,
          user_id: p.user_id,
        });
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

  const filterPatients = (list: PatientListItem[], f: "active" | "inactive" | "all") =>
    list.filter((p) => (f === "all" ? true : f === "active" ? p.is_active : !p.is_active));

  const totalShared = supervisees.reduce((s, r) => s + r.patients.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileType !== "supervisor") {
    return (
      <div className="space-y-8 animate-fade-up max-w-3xl">
        <header>
          <h1 className="font-display text-4xl font-medium">Supervisão</h1>
        </header>
        <div className="rounded-3xl bg-card border border-border shadow-card p-8 sm:p-12 text-center space-y-6">
          <img
            src={michellePhoto}
            alt="Michelle Donegá — Supervisora"
            className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-accent/20 shadow-lg"
            width={112}
            height={112}
          />
          <h2 className="text-xl font-bold">Supervisão com Michelle Donegá</h2>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-semibold">
              <MapPin className="h-3.5 w-3.5" />
              Presencial em Jarinu
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lilac/15 text-lilac-foreground px-4 py-1.5 text-sm font-semibold">
              <Wifi className="h-3.5 w-3.5" />
              Online
            </span>
          </div>
          <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
            Psicóloga clínica especialista em TCC.<br />
            <a
              href="https://instagram.com/psimichelledonega"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-medium"
            >
              @psimichelledonega
            </a>
          </p>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            Esta área é destinada a profissionais com perfil de <strong>Supervisor(a)</strong>.
            Solicite a liberação clicando no botão abaixo.
          </p>
          <Button
            variant="accent"
            className="mt-2"
            onClick={() => {
              const msg = encodeURIComponent(
                `Olá! Sou ${user?.email ?? "usuário(a)"} e gostaria de solicitar a liberação do perfil de Supervisor(a) no Psi Real. Poderia me ajudar?`
              );
              window.open(`https://wa.me/5511947388423?text=${msg}`, "_blank");
              toast.success("Redirecionando para o WhatsApp do administrador…");
            }}
          >
            <Mail className="h-4 w-4" /> Solicitar liberação
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up max-w-3xl">
      <header>
        <h1 className="font-display text-4xl font-medium">Supervisão</h1>
        <p className="mt-2 text-muted-foreground">
          Acompanhe os pacientes compartilhados pelos seus supervisionandos — somente leitura.
        </p>
        {!loading && (
          <div className="mt-3 flex gap-4 text-sm">
            <span className="rounded-lg bg-secondary px-3 py-1 font-medium">
              {supervisees.length} {supervisees.length === 1 ? "supervisionando" : "supervisionandos"}
            </span>
            <span className="rounded-lg bg-secondary px-3 py-1 font-medium">
              <Eye className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              {totalShared} {totalShared === 1 ? "paciente compartilhado" : "pacientes compartilhados"}
            </span>
          </div>
        )}
      </header>

      <PageIntro description="Como supervisor(a), você vê apenas o que cada supervisionando escolhe compartilhar — somente leitura, garantindo o sigilo do paciente e a autonomia do supervisionando." />


      {/* Invite section */}
      <section className="rounded-3xl bg-card border border-border shadow-card p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Convidar supervisionando</h2>
            <p className="text-xs text-muted-foreground">
              O profissional já deve ter conta criada e perfil definido como "Membro Parceiro".
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
              <h2 className="font-display text-xl font-semibold">Supervisionandos & pacientes</h2>
              <p className="text-xs text-muted-foreground">
                Apenas pacientes que o supervisionando compartilhou com você aparecem aqui.
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
                          <Eye className="inline h-3 w-3 mr-1 -mt-0.5" />
                          {s.patients.length} compartilhado{s.patients.length !== 1 && "s"} · {activeCount} ativo{activeCount !== 1 && "s"}
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
                          Nenhum paciente foi compartilhado com você por este supervisionando.
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
                                    onClick={() => openPatientDetail(p)}
                                    className="w-full flex items-center justify-between gap-3 rounded-lg bg-card border border-border p-3 hover:border-primary hover:shadow-soft transition-all text-left"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary font-display font-bold shrink-0">
                                        {p.initials}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium">{p.initials}</p>
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

      {/* Patient detail dialog */}
      <Dialog open={!!selectedPatientItem} onOpenChange={(o) => { if (!o) { setSelectedPatientItem(null); setSelectedPatient(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selectedPatient?.full_name ?? selectedPatientItem?.initials ?? ""}
            </DialogTitle>
            <DialogDescription>
              {(selectedPatient ?? selectedPatientItem)?.is_active ? "Paciente ativo" : "Paciente inativo"} · acesso somente leitura
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </div>
          )}

          {selectedPatient && !detailLoading && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {selectedPatient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{selectedPatient.email}</span>
                  </div>
                )}
                {selectedPatient.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPatient.phone}</span>
                  </div>
                )}
              </div>

              {selectedPatient.session_price != null && (
                <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                  <span className="text-muted-foreground">Valor da sessão: </span>
                  <span className="font-medium">
                    R$ {Number(selectedPatient.session_price).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              )}

              {selectedPatient.notes && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    Observações
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">
                    {selectedPatient.notes}
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-4">
                {/* Recent sessions */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Sessões recentes
                  </div>
                  {detailLoading ? (
                    <div className="py-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" /></div>
                  ) : recentSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-lg bg-secondary/40 p-3">
                      Nenhuma sessão registrada ainda.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {recentSessions.map((s) => (
                        <li key={s.id} className="rounded-lg bg-secondary/40 p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {format(new Date(s.scheduled_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-background text-muted-foreground">
                              {s.status}
                            </span>
                          </div>
                          {s.notes && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.notes}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Latest mood / progress */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Último humor / progresso
                  </div>
                  {detailLoading ? null : !latestProgress ? (
                    <p className="text-sm text-muted-foreground rounded-lg bg-secondary/40 p-3">
                      Nenhum registro de humor/progresso ainda.
                    </p>
                  ) : (
                    <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Smile className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {latestProgress.mood_score != null
                              ? `Humor ${latestProgress.mood_score}/10`
                              : "Sem humor"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(latestProgress.recorded_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {latestProgress.note && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {latestProgress.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Supervision;
