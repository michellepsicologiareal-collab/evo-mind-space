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
  code: string;
  notes: string | null;
  is_active: boolean;
  user_id: string;
}

interface SuperviseeRow {
  id: string;
  full_name: string | null;
  patients: PatientListItem[];
}

interface ClinicalRecord {
  session_date: string;
  session_number: number | null;
  modality: string | null;
  themes: string[] | null;
  chief_complaint: string | null;
  clinical_observations: string | null;
  next_session_plan: string | null;
  engagement: number | null;
  risk_indicator: string | null;
}

interface ProgressEntry {
  recorded_at: string;
  mood_score: number | null;
  note: string | null;
  wellbeing_score: number | null;
  wellbeing_source: string | null;
  patient_context: string | null;
  clinical_observation: string | null;
  attention_flag: "not_assessed" | "none" | "watch" | "urgent" | null;
  data_model: "legacy_unclassified" | "v2_structured" | null;
  themes: string[] | null;
  engagement: number | null;
}

interface ClinicalOverview {
  code: string | null;
  is_active: boolean | null;
  notes: string | null;
  chief_complaint: string | null;
  treatment_plan: string | null;
  last_session_at: string | null;
  next_session_at: string | null;
  formulation: {
    environment: string | null;
    thoughts: string | null;
    emotions: string | null;
    behaviors: string | null;
    physical_reactions: string | null;
    core_beliefs: string | null;
    treatment_goals: unknown;
    ai_summary: string | null;
    updated_at: string | null;
  } | null;
  records: ClinicalRecord[];
  progress: ProgressEntry[];
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
  const [selectedSupervisee, setSelectedSupervisee] = useState<string>("all");
  const [selectedPatientItem, setSelectedPatientItem] = useState<PatientListItem | null>(null);
  const [clinical, setClinical] = useState<ClinicalOverview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openPatientDetail = async (item: PatientListItem) => {
    setSelectedPatientItem(item);
    setClinical(null);
    setDetailLoading(true);

    const { data, error } = await (supabase as any).rpc("get_supervised_patient_clinical", {
      _patient_id: item.id,
    });

    if (error) {
      toast.error("Não foi possível carregar os dados clínicos");
    } else {
      setClinical(data as ClinicalOverview);
    }
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
      const { data: pats } = await (supabase as any).rpc("list_supervised_patients");
      (pats ?? [])
        .filter((p: any) => ids.includes(p.user_id))
        .forEach((p: any) => {
          (patientsByUser[p.user_id] ??= []).push({
            id: p.id,
            initials: p.code,
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
        <PageHeader icon={Users} title="Supervisão" />

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

  const visibleSupervisees =
    selectedSupervisee === "all"
      ? supervisees
      : supervisees.filter((s) => s.id === selectedSupervisee);

  const scopedShared = visibleSupervisees.reduce((s, r) => s + r.patients.length, 0);
  const activeShared = visibleSupervisees.reduce(
    (s, r) => s + r.patients.filter((p) => p.is_active).length,
    0,
  );

  const kpis = [
    {
      kicker: "Supervisionandos",
      value: visibleSupervisees.length,
      hint: selectedSupervisee === "all" ? "profissionais vinculados" : "filtro aplicado",
      dot: "bg-primary",
      blob: "bg-primary/10",
    },
    {
      kicker: "Pacientes compartilhados",
      value: scopedShared,
      hint: "visíveis somente leitura",
      dot: "bg-accent",
      blob: "bg-accent/10",
    },
    {
      kicker: "Em acompanhamento",
      value: activeShared,
      hint: "pacientes ativos",
      dot: "bg-moss",
      blob: "bg-moss/10",
    },
  ];


  return (
    <div className="space-y-8 animate-fade-up max-w-5xl">
      <PageHeader
        icon={Users}
        title="Supervisão"
        subtitle="Acompanhe os pacientes compartilhados pelos seus supervisionandos — somente leitura."
        intro="Como supervisor(a), você vê apenas o que cada supervisionando escolhe compartilhar — somente leitura, garantindo o sigilo do paciente e a autonomia do supervisionando."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.kicker}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-card"
          >
            <div className="relative z-10 space-y-2">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${k.dot}`} />
                {k.kicker}
              </p>
              <p className="font-display text-3xl font-bold leading-none">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </div>
            <span
              className={`pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full ${k.blob}`}
            />
          </div>
        ))}
      </div>





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

        {supervisees.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSupervisee("all")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedSupervisee === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/40"
              }`}
            >
              Todas ({supervisees.length})
            </button>
            {supervisees.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSupervisee(s.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedSupervisee === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s.full_name || "Sem nome"} ({s.patients.length})
              </button>
            ))}
          </div>
        )}

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
            {visibleSupervisees.map((s) => {
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

      {/* Patient detail dialog — clinical only, no financial or personal data */}
      <Dialog open={!!selectedPatientItem} onOpenChange={(o) => { if (!o) { setSelectedPatientItem(null); setClinical(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {selectedPatientItem?.initials ?? clinical?.code ?? ""}
            </DialogTitle>
            <DialogDescription>
              {(clinical?.is_active ?? selectedPatientItem?.is_active) ? "Paciente ativo" : "Paciente inativo"} · acesso somente leitura · identificação anônima
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </div>
          )}

          {clinical && !detailLoading && (
            <div className="space-y-5">
              {/* Datas */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-secondary/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Última sessão</p>
                  <p className="text-sm font-medium">
                    {clinical.last_session_at
                      ? format(new Date(clinical.last_session_at), "dd 'de' MMM yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Próxima sessão</p>
                  <p className="text-sm font-medium">
                    {clinical.next_session_at
                      ? format(new Date(clinical.next_session_at), "dd 'de' MMM yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>

              {clinical.chief_complaint && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Queixa principal</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">
                    {clinical.chief_complaint}
                  </p>
                </section>
              )}

              {clinical.treatment_plan && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Objetivos terapêuticos</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">
                    {clinical.treatment_plan}
                  </p>
                </section>
              )}

              {clinical.formulation && (
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" /> Formulação de caso
                  </h3>
                  <div className="rounded-lg bg-secondary/40 p-3 space-y-2 text-sm">
                    {([
                      ["Ambiente", clinical.formulation.environment],
                      ["Pensamentos", clinical.formulation.thoughts],
                      ["Emoções", clinical.formulation.emotions],
                      ["Comportamentos", clinical.formulation.behaviors],
                      ["Reações físicas", clinical.formulation.physical_reactions],
                      ["Crenças centrais", clinical.formulation.core_beliefs],
                      ["Resumo clínico", clinical.formulation.ai_summary],
                    ] as [string, string | null][])
                      .filter(([, v]) => !!v)
                      .map(([label, value]) => (
                        <p key={label} className="text-muted-foreground whitespace-pre-wrap">
                          <span className="font-medium text-foreground">{label}: </span>
                          {value}
                        </p>
                      ))}
                    {Array.isArray(clinical.formulation.treatment_goals) &&
                      clinical.formulation.treatment_goals.length > 0 && (
                        <div>
                          <p className="font-medium text-foreground">Metas de tratamento:</p>
                          <ul className="list-disc pl-5 text-muted-foreground">
                            {(clinical.formulation.treatment_goals as any[]).map((g, i) => (
                              <li key={i}>{typeof g === "string" ? g : g?.descricao ?? g?.title ?? JSON.stringify(g)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </section>
              )}

              {clinical.notes && (
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" /> Pontos importantes
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">
                    {clinical.notes}
                  </p>
                </section>
              )}

              {/* Registros de sessão */}
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" /> Registros de sessão
                </h3>
                {clinical.records.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg bg-secondary/40 p-3">
                    Nenhum registro clínico compartilhado ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {clinical.records.map((r, i) => (
                      <li key={i} className="rounded-lg bg-secondary/40 p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium">
                            {format(new Date(r.session_date), "dd/MM/yyyy", { locale: ptBR })}
                            {r.session_number ? ` · Sessão ${r.session_number}` : ""}
                          </span>
                          {r.risk_indicator && r.risk_indicator !== "none" && (
                            <span className="text-[10px] uppercase rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-semibold">
                              Risco: {r.risk_indicator}
                            </span>
                          )}
                        </div>
                        {r.themes && r.themes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.themes.map((t) => (
                              <span key={t} className="text-[10px] rounded-full px-2 py-0.5 bg-lilac/30 text-primary-dark font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.chief_complaint && (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Queixa: </span>{r.chief_complaint}
                          </p>
                        )}
                        {r.clinical_observations && (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Observações: </span>{r.clinical_observations}
                          </p>
                        )}
                        {r.next_session_plan && (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Estratégias / próximos passos: </span>{r.next_session_plan}
                          </p>
                        )}
                        {r.engagement != null && (
                          <p className="text-xs text-muted-foreground">Engajamento: {r.engagement}/10</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Evolução e humor */}
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Evolução e humor
                </h3>
                {clinical.progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg bg-secondary/40 p-3">
                    Nenhum registro de humor/progresso ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {clinical.progress.map((g, i) => (
                      <li key={i} className="rounded-lg bg-secondary/40 p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Smile className="h-4 w-4 text-primary" />
                            {g.data_model === "v2_structured" ? (
                              <>
                                <span className="font-medium">
                                  {g.wellbeing_score != null ? `Bem-estar ${g.wellbeing_score}/10` : "Sem escore de bem-estar"}
                                </span>
                                {g.wellbeing_source && (
                                  <span className="text-[10px] uppercase rounded-full px-2 py-0.5 bg-lilac/40 text-primary-dark font-semibold">
                                    {g.wellbeing_source === "patient_self_report" ? "Autorrelato" : "Estimativa profissional"}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="font-medium">
                                {g.mood_score != null ? `Humor ${g.mood_score}/10` : "Sem humor"}
                              </span>
                            )}
                            {g.attention_flag === "watch" && (
                              <span className="text-[10px] uppercase rounded-full px-2 py-0.5 bg-amber-200/70 text-amber-900 font-semibold">
                                Observar
                              </span>
                            )}
                            {g.attention_flag === "urgent" && (
                              <span className="text-[10px] uppercase rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-semibold">
                                Urgente
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(g.recorded_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {g.patient_context && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Contexto: </span>{g.patient_context}
                          </p>
                        )}
                        {g.clinical_observation && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Observação clínica: </span>{g.clinical_observation}
                          </p>
                        )}
                        {g.data_model !== "v2_structured" && g.note && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{g.note}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Supervision;

