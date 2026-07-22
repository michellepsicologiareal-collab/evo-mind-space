import { useEffect, useMemo, useState } from "react";
import { HelpCard } from "@/components/app/HelpCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChildAnamnesisForm } from "@/components/app/ChildAnamnesisForm";
import { AdultAnamnesisViewer } from "@/components/app/AdultAnamnesisViewer";
import { CardSkeleton } from "@/components/app/Skeletons";
import { Baby, Search, Pencil, Trash2, Users, AlertTriangle, Eye, Send, Copy, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { preserveScroll, keepScroll } from "@/lib/preserveScroll";
import { PageHeader } from "@/components/app/PageHeader";

interface ChildRow {
  id: string;
  patient_id: string;
  child_name: string;
  chief_complaint: string;
  updated_at: string;
  created_at: string;
}

interface AdultRow {
  id: string;
  patient_id: string;
  full_name: string;
  reason_for_seeking: string | null;
  risk_flag: boolean;
  status: string;
  submitted_at: string;
  updated_at: string;
}

const Anamneses = () => {
  const { user } = useAuth();
  const [childRows, setChildRows] = useState<ChildRow[]>([]);
  const [adultRows, setAdultRows] = useState<AdultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingChild, setEditingChild] = useState<{ patient_id: string; name: string } | null>(null);
  const [viewingAdult, setViewingAdult] = useState<{ id: string; name: string } | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendType, setSendType] = useState<"adult" | "child">("adult");
  const [sendPatients, setSendPatients] = useState<Array<{ id: string; full_name: string; category: string | null; phone: string | null }>>([]);
  const [sendSearch, setSendSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  const openSend = async (type: "adult" | "child") => {
    if (!user) return;
    setSendType(type);
    setSendOpen(true);
    setSendSearch("");
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, category, phone")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("full_name");
    if (error) { toast.error("Erro ao carregar pacientes"); return; }
    setSendPatients((data ?? []) as any);
  };

  const generateLink = async (p: { id: string; full_name: string; phone: string | null }) => {
    if (!user) return;
    setSending(p.id);
    const table = sendType === "child" ? "anamnesis_invites" : "adult_anamnesis_invites";
    const slug = sendType === "child" ? "anamnese-crianca" : "anamnese-adulto";
    const { data, error } = await supabase
      .from(table)
      .insert({ patient_id: p.id, user_id: user.id } as any)
      .select("token")
      .single();
    setSending(null);
    if (error || !data?.token) { toast.error("Não foi possível gerar o link."); return; }
    const link = `${window.location.origin}/${slug}/${data.token}`;
    const phone = (p.phone || "").replace(/\D/g, "");
    const msg = `Olá! Para iniciarmos o atendimento de ${p.full_name}, por favor preencha a anamnese neste link: ${link}`;
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      toast.success("Link aberto no WhatsApp");
    } else {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência");
    }
  };

  const filteredSendPatients = useMemo(() => {
    const q = sendSearch.trim().toLowerCase();
    const base = sendType === "child"
      ? sendPatients.filter(p => p.category === "crianca")
      : sendPatients.filter(p => p.category !== "crianca");
    if (!q) return base;
    return base.filter(p => p.full_name.toLowerCase().includes(q));
  }, [sendPatients, sendSearch, sendType]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [c, a] = await Promise.all([
      supabase
        .from("child_anamneses")
        .select("id,patient_id,child_name,chief_complaint,updated_at,created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("adult_anamneses")
        .select("id,patient_id,full_name,reason_for_seeking,risk_flag,status,submitted_at,updated_at")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false }),
    ]);
    if (c.error) toast.error("Erro ao carregar anamneses (criança)");
    if (a.error) toast.error("Erro ao carregar anamneses (adulto)");
    setChildRows((c.data ?? []) as ChildRow[]);
    setAdultRows((a.data ?? []) as AdultRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const filteredChild = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return childRows;
    return childRows.filter((r) => r.child_name.toLowerCase().includes(q));
  }, [childRows, search]);

  const filteredAdult = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adultRows;
    return adultRows.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [adultRows, search]);

  const removeChild = async (id: string) => {
    if (!confirm("Excluir esta anamnese?")) return;
    const { error } = await supabase.from("child_anamneses").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Anamnese excluída");
    await preserveScroll(() => load());
  };

  const removeAdult = async (id: string) => {
    if (!confirm("Excluir esta anamnese?")) return;
    const { error } = await supabase.from("adult_anamneses").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Anamnese excluída");
    await preserveScroll(() => load());
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <HelpCard
        id="anamneses"
        title="Anamneses"
        description="Colete informações iniciais e acompanhe a evolução clínica desde o início do tratamento."
        sections={[
          { label: "Quando usar", content: "Ao receber um novo paciente, envie o link de anamnese para preenchimento antes da primeira sessão." },
          { label: "Conexões", content: "As respostas ficam vinculadas à ficha do paciente e alimentam a Formulação de Caso e o Plano Terapêutico." },
        ]}
      />
      <PageHeader
        icon={Baby}
        title="Anamneses"
        subtitle="Anamneses preenchidas pelos seus pacientes."
        intro="A anamnese organiza a história de vida, o motivo da queixa e o contexto de cada paciente — base clínica para hipóteses, plano terapêutico e devolutiva."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar pelo nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="accent" onClick={() => openSend("adult")} className="gap-2">
                <Send className="h-4 w-4" /> Enviar (Adulto)
              </Button>
              <Button variant="outline" onClick={() => openSend("child")} className="gap-2">
                <Baby className="h-4 w-4" /> Enviar (Criança)
              </Button>
            </div>
          </div>
        }
      />

      <Tabs defaultValue="adult" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adult" className="gap-2"><Users className="h-4 w-4" /> Adultos ({adultRows.length})</TabsTrigger>
          <TabsTrigger value="child" className="gap-2"><Baby className="h-4 w-4" /> Crianças ({childRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="adult">
          {loading ? (
            <CardSkeleton count={3} />
          ) : filteredAdult.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="mt-4 font-display text-lg font-medium text-foreground/70">Nenhuma anamnese adulto ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Gere o link na ficha do paciente para o preenchimento antes da primeira sessão.</p>
            </div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-4">
              {filteredAdult.map((r) => (
                <li key={r.id}>
                  <Card className="p-5 rounded-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.full_name || "Sem nome"}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {r.status === "recebida" ? "Recebida" : r.status}
                          </span>
                          {r.risk_flag && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Atenção
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviada em {format(new Date(r.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => setViewingAdult({ id: r.id, name: r.full_name })} aria-label="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeAdult(r.id)} aria-label="Excluir" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {r.reason_for_seeking && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                        <span className="font-medium text-foreground/70">Motivo da procura: </span>{r.reason_for_seeking}
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="child">
          {loading ? (
            <CardSkeleton count={3} />
          ) : filteredChild.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
              <Baby className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="mt-4 font-display text-lg font-medium text-foreground/70">Nenhuma anamnese ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Abra a ficha de um paciente criança e preencha a primeira anamnese.</p>
            </div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-4">
              {filteredChild.map((r) => (
                <li key={r.id}>
                  <Card className="p-5 rounded-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.child_name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Atualizado em {format(new Date(r.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => setEditingChild({ patient_id: r.patient_id, name: r.child_name })} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeChild(r.id)} aria-label="Excluir" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {r.chief_complaint && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                        <span className="font-medium text-foreground/70">Queixa principal: </span>{r.chief_complaint}
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingChild} onOpenChange={(o) => !o && setEditingChild(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{editingChild?.name}</DialogTitle>
            <DialogDescription>Anamnese — Criança</DialogDescription>
          </DialogHeader>
          {editingChild && <ChildAnamnesisForm patientId={editingChild.patient_id} patientName={editingChild.name} onSaved={() => { keepScroll(); preserveScroll(() => load()); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingAdult} onOpenChange={(o) => !o && setViewingAdult(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{viewingAdult?.name}</DialogTitle>
            <DialogDescription>Anamnese Inicial — Adulto</DialogDescription>
          </DialogHeader>
          {viewingAdult && <AdultAnamnesisViewer anamnesisId={viewingAdult.id} onSaved={() => { keepScroll(); preserveScroll(() => load()); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              {sendType === "adult" ? <Users className="h-5 w-5" /> : <Baby className="h-5 w-5" />}
              Enviar anamnese — {sendType === "adult" ? "Adulto" : "Criança"}
            </DialogTitle>
            <DialogDescription>Selecione o paciente. O link será aberto no WhatsApp se houver telefone, ou copiado para você.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar paciente..." value={sendSearch} onChange={(e) => setSendSearch(e.target.value)} />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {filteredSendPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum paciente {sendType === "child" ? "criança" : "adulto"} encontrado.</p>
            ) : filteredSendPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => generateLink(p)}
                disabled={sending === p.id}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-background hover:bg-muted/40 px-3 py-2.5 text-left transition-colors disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.full_name}</p>
                  {p.phone && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {p.phone}</p>}
                </div>
                <span className="text-xs text-primary font-medium shrink-0 inline-flex items-center gap-1">
                  {p.phone ? <><MessageCircle className="h-3.5 w-3.5" /> Enviar</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Anamneses;
