import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, User, Phone, Mail, Loader2, MoreHorizontal, Trash2, Pencil, Eye, ClipboardList, MessageCircle, Stethoscope, Brain, CalendarDays, Smile, FileText, Baby } from "lucide-react";
import { TccRecords } from "@/components/app/TccRecords";
import { CaseFormulation } from "@/components/app/CaseFormulation";
import { ChildAnamnesisForm } from "@/components/app/ChildAnamnesisForm";
import { PatientSessionHistory } from "@/components/app/PatientSessionHistory";
import { PatientMoodChart } from "@/components/app/PatientMoodChart";
import { PatientSessionRecords } from "@/components/app/PatientSessionRecords";
import { CardSkeleton } from "@/components/app/Skeletons";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { PremiumGate } from "@/components/app/PremiumGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { UnsavedGuardDialog } from "@/components/app/UnsavedGuardDialog";

const PATIENT_CATEGORIES = [
  { value: "adolescente", label: "Adolescente" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "casal", label: "Casal" },
  { value: "crianca", label: "Criança" },
  { value: "grupo", label: "Grupo" },
  { value: "individual", label: "Individual" },
  { value: "sessao_breve", label: "Sessão Breve" },
  { value: "supervisao", label: "Supervisão" },
] as const;

const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  phone_ddi: z.string().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  session_price: z.string().optional(),
  chief_complaint: z.string().trim().max(2000).optional().or(z.literal("")),
  treatment_plan: z.string().trim().max(4000).optional().or(z.literal("")),
  anamnesis: z.string().trim().max(6000).optional().or(z.literal("")),
  category: z.enum(["adolescente", "avaliacao", "casal", "crianca", "grupo", "individual", "sessao_breve", "supervisao"]).optional(),
});

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  session_price: number | null;
  shared_with_supervisor: boolean;
  chief_complaint: string | null;
  treatment_plan: string | null;
  anamnesis: string | null;
  category: "adolescente" | "avaliacao" | "casal" | "crianca" | "grupo" | "individual" | "sessao_breve" | "supervisao";
  has_financial_responsible: boolean;
  financial_responsible_name: string | null;
  financial_responsible_phone: string | null;
  treatment_start_date: string | null;
  treatment_end_date: string | null;
  has_psychiatrist: boolean;
  psychiatrist_name: string | null;
  psychiatrist_phone: string | null;
  medications: string | null;
}

const FREE_PATIENT_LIMIT = 5;

const Patients = () => {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [gateOpen, setGateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [tccPatient, setTccPatient] = useState<Patient | null>(null);
  const [padeksyPatient, setPadeksyPatient] = useState<Patient | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [moodPatient, setMoodPatient] = useState<Patient | null>(null);
  const [recordsPatient, setRecordsPatient] = useState<Patient | null>(null);
  const [anamnesisPatient, setAnamnesisPatient] = useState<Patient | null>(null);
  const [pixKey, setPixKey] = useState<string>("");
  const [profName, setProfName] = useState<string>("");
  const [profCrp, setProfCrp] = useState<string>("");
  const patientGuard = useUnsavedGuard();
  const [latestSessionDates, setLatestSessionDates] = useState<Record<string, string>>({});

  const DRAFT_KEY = "rascunho_novo_paciente";
  type FormState = { full_name: string; email: string; phone: string; phone_ddi: string; notes: string; session_price: string; chief_complaint: string; treatment_plan: string; anamnesis: string; category: "adolescente" | "avaliacao" | "casal" | "crianca" | "grupo" | "individual" | "sessao_breve" | "supervisao"; has_financial_responsible: boolean; financial_responsible_name: string; financial_responsible_phone: string; financial_responsible_ddi: string; treatment_start_date: string; treatment_end_date: string; has_psychiatrist: boolean; psychiatrist_name: string; psychiatrist_phone: string; psychiatrist_phone_ddi: string; medications: string };
  const emptyForm: FormState = { full_name: "", email: "", phone: "", phone_ddi: "+55", notes: "", session_price: "", chief_complaint: "", treatment_plan: "", anamnesis: "", category: "individual", has_financial_responsible: false, financial_responsible_name: "", financial_responsible_phone: "", financial_responsible_ddi: "+55", treatment_start_date: "", treatment_end_date: "", has_psychiatrist: false, psychiatrist_name: "", psychiatrist_phone: "", psychiatrist_phone_ddi: "+55", medications: "" };
  const [form, setFormRaw] = useState<FormState>(emptyForm);
  const [draftRestored, setDraftRestored] = useState(false);
  const setForm = useCallback((v: typeof emptyForm | ((prev: typeof emptyForm) => typeof emptyForm)) => { patientGuard.markDirty(); setFormRaw(v); }, [patientGuard.markDirty]);

  // Auto-save draft to localStorage when form changes (only for new patient, not editing)
  useEffect(() => {
    if (!open || editing) return;
    // Only save if form has meaningful data
    if (form.full_name || form.email || form.phone || form.notes || form.chief_complaint) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
    }
  }, [form, open, editing]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftRestored(false);
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [patientsRes, profileRes, sessionsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("user_id", user.id).order("full_name"),
      supabase.from("profiles").select("full_name, pix_key, crp").eq("id", user.id).maybeSingle(),
      supabase.from("sessions").select("patient_id, scheduled_at").eq("user_id", user.id).eq("payment_status", "pending").order("scheduled_at", { ascending: false }),
    ]);
    if (patientsRes.error) toast.error("Erro ao carregar pacientes");
    setPatients(patientsRes.data ?? []);
    setPixKey((profileRes.data as any)?.pix_key ?? "");
    setProfName(profileRes.data?.full_name ?? "");
    setProfCrp((profileRes.data as any)?.crp ?? "");
    // Build map: patient_id -> most recent pending session date
    const dateMap: Record<string, string> = {};
    (sessionsRes.data ?? []).forEach((s: any) => {
      if (s.patient_id && !dateMap[s.patient_id]) dateMap[s.patient_id] = s.scheduled_at;
    });
    setLatestSessionDates(dateMap);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  useAutoRefresh(() => { if (user) load(); }, { routePath: "/app/pacientes" });

  const openNew = () => {
    if (!isPremium && patients.length >= FREE_PATIENT_LIMIT) {
      setGateOpen(true);
      return;
    }
    setEditing(null);
    // Try to restore draft from localStorage
    let restored = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as FormState;
        if (draft.full_name || draft.email || draft.phone || draft.notes || draft.chief_complaint) {
          setFormRaw(draft);
          restored = true;
          setDraftRestored(true);
        }
      }
    } catch {}
    if (!restored) {
      setFormRaw(emptyForm);
      setDraftRestored(false);
    }
    patientGuard.resetDirty();
    setOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    // Extract DDI from stored phone if it starts with +
    const rawPhone = p.phone ?? "";
    let ddi = "";
    let localPhone = rawPhone;
    const ddiMatch = rawPhone.match(/^(\+\d{1,4})\s*(.*)/);
    if (ddiMatch) {
      ddi = ddiMatch[1];
      localPhone = ddiMatch[2];
    }
    // Extract DDI from financial responsible phone
    const rawFrPhone = p.financial_responsible_phone ?? "";
    let frDdi = "";
    let frLocalPhone = rawFrPhone;
    const frDdiMatch = rawFrPhone.match(/^(\+\d{1,4})\s*(.*)/);
    if (frDdiMatch) {
      frDdi = frDdiMatch[1];
      frLocalPhone = frDdiMatch[2];
    }
    // Extract DDI from psychiatrist phone
    const rawPsyPhone = p.psychiatrist_phone ?? "";
    let psyDdi = "";
    let psyLocalPhone = rawPsyPhone;
    const psyDdiMatch = rawPsyPhone.match(/^(\+\d{1,4})\s*(.*)/);
    if (psyDdiMatch) {
      psyDdi = psyDdiMatch[1];
      psyLocalPhone = psyDdiMatch[2];
    }
    setForm({
      full_name: p.full_name,
      email: p.email ?? "",
      phone: localPhone,
      phone_ddi: ddi,
      notes: p.notes ?? "",
      session_price: p.session_price?.toString() ?? "",
      chief_complaint: p.chief_complaint ?? "",
      treatment_plan: p.treatment_plan ?? "",
      anamnesis: p.anamnesis ?? "",
      category: p.category ?? "individual",
      has_financial_responsible: p.has_financial_responsible ?? false,
      financial_responsible_name: p.financial_responsible_name ?? "",
      financial_responsible_phone: frLocalPhone,
      financial_responsible_ddi: frDdi,
      treatment_start_date: p.treatment_start_date ?? "",
      treatment_end_date: p.treatment_end_date ?? "",
      has_psychiatrist: p.has_psychiatrist ?? false,
      psychiatrist_name: p.psychiatrist_name ?? "",
      psychiatrist_phone: psyLocalPhone,
      psychiatrist_phone_ddi: psyDdi,
      medications: p.medications ?? "",
    });
    patientGuard.resetDirty();
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = patientSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone ? `${parsed.data.phone_ddi || "+55"} ${parsed.data.phone}`.trim() : null,
      notes: parsed.data.notes || null,
      session_price: parsed.data.session_price ? Number(parsed.data.session_price) : null,
      chief_complaint: parsed.data.chief_complaint || null,
      treatment_plan: parsed.data.treatment_plan || null,
      anamnesis: parsed.data.anamnesis || null,
      category: parsed.data.category || "individual",
      has_financial_responsible: form.has_financial_responsible,
      financial_responsible_name: form.has_financial_responsible ? (form.financial_responsible_name || null) : null,
      financial_responsible_phone: form.has_financial_responsible && form.financial_responsible_phone
        ? `${form.financial_responsible_ddi || "+55"} ${form.financial_responsible_phone}`.trim()
        : null,
      treatment_start_date: form.treatment_start_date || null,
      treatment_end_date: form.treatment_end_date || null,
      has_psychiatrist: form.has_psychiatrist,
      psychiatrist_name: form.has_psychiatrist ? (form.psychiatrist_name || null) : null,
      psychiatrist_phone: form.has_psychiatrist && form.psychiatrist_phone
        ? `${form.psychiatrist_phone_ddi || "+55"} ${form.psychiatrist_phone}`.trim()
        : null,
      medications: form.medications || null,
    };

    const { error } = editing
      ? await supabase.from("patients").update(payload).eq("id", editing.id)
      : await supabase.from("patients").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar paciente");
      return;
    }
    toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado");
    if (!editing) clearDraft();
    patientGuard.resetDirty();
    setOpen(false);
    load();
  };

  const handleDelete = async (p: Patient) => {
    if (!confirm(`Excluir ${p.full_name}? As sessões vinculadas também serão removidas.`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", p.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Paciente excluído");
    load();
  };

  const toggleActive = async (p: Patient) => {
    const { error } = await supabase.from("patients").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error("Erro ao atualizar");
    load();
  };

  const toggleSharing = async (p: Patient) => {
    const { error } = await supabase
      .from("patients")
      .update({ shared_with_supervisor: !p.shared_with_supervisor } as any)
      .eq("id", p.id);
    if (error) return toast.error("Erro ao atualizar compartilhamento");
    setPatients((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, shared_with_supervisor: !x.shared_with_supervisor } : x))
    );
  };

  const activeCount = patients.filter((p) => p.is_active).length;
  const inactiveCount = patients.length - activeCount;

  const buildWhatsAppUrl = (p: Patient) => {
    // Use financial responsible phone if available
    let digits: string;
    if (p.has_financial_responsible && p.financial_responsible_phone) {
      digits = p.financial_responsible_phone.replace(/\D/g, "");
    } else {
      digits = normalizePhoneForWhatsApp(p.phone);
    }
    if (!digits) return null;

    const recipientName = p.has_financial_responsible && p.financial_responsible_name
      ? p.financial_responsible_name.split(" ")[0]
      : p.full_name.split(" ")[0];
    const valor = p.session_price != null ? `R$ ${Number(p.session_price).toFixed(2).replace(".", ",")}` : "a combinar";
    const firstName = profName ? profName.split(" ")[0] : "";
    const message = [
      `Olá, ${recipientName}! Aqui é a sua psi, ${firstName || "sua psicóloga"}.`,
      "",
      latestSessionDates[p.id]
        ? `Passando para lembrar do acerto referente à nossa sessão de ${format(new Date(latestSessionDates[p.id]), "dd/MM/yyyy")}.`
        : `Passando para lembrar do acerto referente à sua sessão.`,
      "",
      `Valor: ${valor}`,
      pixKey ? `Chave Pix: ${pixKey}` : "",
      "",
      `Assim que realizar, pode me enviar o comprovante por aqui. Qualquer dúvida, fico à disposição!`,
      "",
      profName || "",
      profCrp ? `Psicóloga | CRP ${profCrp}` : "Psicóloga",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const filtered = patients
    .filter((p) =>
      statusFilter === "all" ? true : statusFilter === "active" ? p.is_active : !p.is_active
    )
    .filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="sticky top-0 md:-mx-6 lg:-mx-10 -mx-6 px-6 lg:px-10 py-4 bg-card border-b border-[hsl(var(--sidebar-border))] z-20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-medium">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie quem está sob seus cuidados.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) { patientGuard.guardClose(() => { if (!editing) clearDraft(); setOpen(false); }, () => setOpen(false)); } else { setOpen(true); } }}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px] bg-[#8B4A52] text-white hover:bg-[#7a4047]" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto [&_input]:scroll-mt-24 [&_textarea]:scroll-mt-24">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{editing ? "Editar paciente" : "Novo paciente"}</DialogTitle>
              <DialogDescription>Cadastre as informações do paciente.</DialogDescription>
            </DialogHeader>
            {draftRestored && !editing && (
              <div className="rounded-lg bg-accent/20 border border-accent/30 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between gap-2">
                <span>📝 Rascunho recuperado. Continue de onde parou.</span>
                <Button type="button" variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={() => { clearDraft(); setFormRaw(emptyForm); }}>Descartar</Button>
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {PATIENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.phone_ddi}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (v && !v.startsWith("+")) v = "+" + v;
                        setForm({ ...form, phone_ddi: v });
                      }}
                      className="w-[80px] shrink-0 text-center"
                      placeholder="+55"
                      maxLength={5}
                    />
                    <Input id="phone" className="flex-1" placeholder="11 99988-7766" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Valor da sessão (R$)</Label>
                <Input id="price" type="number" step="0.01" min="0" value={form.session_price} onChange={(e) => setForm({ ...form, session_price: e.target.value })} />
              </div>

              {/* Financial Responsible Toggle */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_financial_responsible" className="text-sm font-medium">Responsável financeiro é outra pessoa?</Label>
                  <Switch
                    id="has_financial_responsible"
                    checked={form.has_financial_responsible}
                    onCheckedChange={(checked) => setForm({ ...form, has_financial_responsible: checked })}
                  />
                </div>
                {form.has_financial_responsible && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="space-y-2">
                      <Label htmlFor="fr_name">Nome do responsável</Label>
                      <Input id="fr_name" placeholder="Nome completo" value={form.financial_responsible_name} onChange={(e) => setForm({ ...form, financial_responsible_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fr_phone">Celular / WhatsApp do responsável</Label>
                      <div className="flex gap-2">
                        <Input
                          value={form.financial_responsible_ddi}
                          onChange={(e) => {
                            let v = e.target.value;
                            if (v && !v.startsWith("+")) v = "+" + v;
                            setForm({ ...form, financial_responsible_ddi: v });
                          }}
                          className="w-[80px] shrink-0 text-center"
                          placeholder="+55"
                          maxLength={5}
                        />
                        <Input id="fr_phone" className="flex-1" placeholder="11 99988-7766" value={form.financial_responsible_phone} onChange={(e) => setForm({ ...form, financial_responsible_phone: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Datas de tratamento */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="treatment_start_date">Início do tratamento</Label>
                  <Input id="treatment_start_date" type="date" value={form.treatment_start_date} onChange={(e) => setForm({ ...form, treatment_start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="treatment_end_date">Término do tratamento</Label>
                  <Input id="treatment_end_date" type="date" value={form.treatment_end_date} onChange={(e) => setForm({ ...form, treatment_end_date: e.target.value })} />
                </div>
              </div>

              {/* Acompanhamento psiquiátrico */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_psychiatrist" className="text-sm font-medium">Faz acompanhamento psiquiátrico?</Label>
                  <Switch
                    id="has_psychiatrist"
                    checked={form.has_psychiatrist}
                    onCheckedChange={(checked) => setForm({ ...form, has_psychiatrist: checked })}
                  />
                </div>
                {form.has_psychiatrist && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="space-y-2">
                      <Label htmlFor="psychiatrist_name">Nome do médico</Label>
                      <Input id="psychiatrist_name" placeholder="Nome do psiquiatra" value={form.psychiatrist_name} onChange={(e) => setForm({ ...form, psychiatrist_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="psychiatrist_phone">WhatsApp do médico</Label>
                      <div className="flex gap-2">
                        <Input
                          value={form.psychiatrist_phone_ddi}
                          onChange={(e) => {
                            let v = e.target.value;
                            if (v && !v.startsWith("+")) v = "+" + v;
                            setForm({ ...form, psychiatrist_phone_ddi: v });
                          }}
                          className="w-[80px] shrink-0 text-center"
                          placeholder="+55"
                          maxLength={5}
                        />
                        <Input id="psychiatrist_phone" className="flex-1" placeholder="11 99988-7766" value={form.psychiatrist_phone} onChange={(e) => setForm({ ...form, psychiatrist_phone: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Medicamentos */}
              <div className="space-y-2">
                <Label htmlFor="medications">Medicamentos em uso</Label>
                <Textarea id="medications" rows={3} className="min-h-[80px]" placeholder="Liste os medicamentos que o paciente toma atualmente..." value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chief_complaint">Queixa Principal</Label>
                <Textarea id="chief_complaint" rows={3} className="min-h-[80px]" placeholder="Descreva a queixa principal do paciente..." value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatment_plan">Plano de Tratamento</Label>
                <Textarea id="treatment_plan" rows={4} className="min-h-[100px]" placeholder="Objetivos terapêuticos, intervenções planejadas..." value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anamnesis">Histórico / Anamnese</Label>
                <Textarea id="anamnesis" rows={5} className="min-h-[120px]" placeholder="Histórico pessoal, familiar, médico..." value={form.anamnesis} onChange={(e) => setForm({ ...form, anamnesis: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => patientGuard.guardClose(() => { if (!editing) clearDraft(); setOpen(false); }, () => setOpen(false))}>Cancelar</Button>
                <Button type="submit" variant="accent" className="min-h-[44px]" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar paciente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Ativos ({activeCount})</TabsTrigger>
            <TabsTrigger value="inactive">Inativos ({inactiveCount})</TabsTrigger>
            <TabsTrigger value="all">Todos ({patients.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 font-display text-lg font-medium text-foreground/70">
            {patients.length === 0 ? "Pronto para começar?" : "Nenhum resultado encontrado."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {patients.length === 0 ? "Cadastre seu primeiro paciente e organize seu consultório." : "Tente outra busca ou limpe o filtro."}
          </p>
          {patients.length === 0 && (
            <Button variant="accent" className="mt-5" onClick={openNew}>
              <Plus className="h-4 w-4" /> Cadastrar primeiro paciente
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <li key={p.id} className="rounded-2xl bg-card border border-border shadow-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground font-display text-base">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {p.is_active ? <span className="text-primary-glow">● Ativo</span> : <span>○ Inativo</span>}
                      {(() => {
                        const styles: Record<string, string> = {
                          individual: "bg-primary/15 text-primary",
                          crianca: "bg-lilac/20 text-lilac-foreground",
                          adolescente: "bg-sage/15 text-sage",
                          casal: "bg-accent/15 text-accent",
                          avaliacao: "bg-serene/15 text-serene",
                          grupo: "bg-moss/15 text-moss",
                          sessao_breve: "bg-gold/20 text-foreground",
                          supervisao: "bg-[hsl(var(--admin-accent))]/15 text-[hsl(var(--admin-accent))]",
                        };
                        const cls = styles[p.category] ?? styles.individual;
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium ${cls}`}>
                            {PATIENT_CATEGORIES.find(c => c.value === p.category)?.label ?? "Individual"}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHistoryPatient(p)}><CalendarDays className="h-4 w-4" /> Histórico de Sessões</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTccPatient(p)}><ClipboardList className="h-4 w-4" /> Prontuário TCC</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPadeksyPatient(p)}><Brain className="h-4 w-4" /> Formulação Padesky</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAnamnesisPatient(p)}><Baby className="h-4 w-4" /> Anamnese (Criança)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const link = `${window.location.origin}/anamnese-crianca/${p.id}`;
                      const phone = normalizePhoneForWhatsApp(p.phone || "");
                      const msg = encodeURIComponent(`Olá! Segue o link para você preencher a anamnese de ${p.full_name}: ${link}`);
                      const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
                      navigator.clipboard?.writeText(link).catch(() => {});
                      toast.success("Link copiado", { description: "Abrindo WhatsApp..." });
                      window.open(url, "_blank");
                    }}>
                      <MessageCircle className="h-4 w-4" /> Enviar link de anamnese (WhatsApp)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open(`https://wa.me/5511947388423?text=${encodeURIComponent(`Olá Michelle, preciso de supervisão para o caso do(a) paciente: ${p.full_name}`)}`, "_blank")}>
                      <Stethoscope className="h-4 w-4" /> Pedir Supervisão deste Caso
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(p)}>
                      {p.is_active ? "Marcar inativo" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(p)} className="text-destructive">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                {p.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {p.email}</p>}
                {p.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone}</p>}
                {p.session_price != null && <p className="text-foreground font-medium">R$ {Number(p.session_price).toFixed(2).replace(".", ",")} <span className="text-muted-foreground font-normal">/ sessão</span></p>}
              </div>

              {/* Detalhes preenchidos do paciente */}
              {(p.chief_complaint || p.treatment_plan || p.anamnesis || p.notes ||
                p.treatment_start_date || p.treatment_end_date ||
                (p.has_financial_responsible && (p.financial_responsible_name || p.financial_responsible_phone)) ||
                (p.has_psychiatrist && (p.psychiatrist_name || p.psychiatrist_phone)) ||
                p.medications) && (
                <div className="mt-4 rounded-xl bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.2)] p-3 space-y-2.5 text-sm">
                  {p.chief_complaint && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Queixa principal</p>
                      <p className="text-foreground whitespace-pre-line">{p.chief_complaint}</p>
                    </div>
                  )}
                  {p.treatment_plan && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Plano terapêutico</p>
                      <p className="text-foreground whitespace-pre-line">{p.treatment_plan}</p>
                    </div>
                  )}
                  {p.anamnesis && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Anamnese</p>
                      <p className="text-foreground whitespace-pre-line">{p.anamnesis}</p>
                    </div>
                  )}
                  {(p.treatment_start_date || p.treatment_end_date) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {p.treatment_start_date && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Início: </span>
                          <span className="text-foreground">{format(new Date(p.treatment_start_date + "T00:00:00"), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                      {p.treatment_end_date && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Encerramento: </span>
                          <span className="text-foreground">{format(new Date(p.treatment_end_date + "T00:00:00"), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {p.has_financial_responsible && (p.financial_responsible_name || p.financial_responsible_phone) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Responsável financeiro</p>
                      <p className="text-foreground">
                        {p.financial_responsible_name}
                        {p.financial_responsible_phone && <span className="text-muted-foreground"> · {p.financial_responsible_phone}</span>}
                      </p>
                    </div>
                  )}
                  {p.has_psychiatrist && (p.psychiatrist_name || p.psychiatrist_phone) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Psiquiatra</p>
                      <p className="text-foreground">
                        {p.psychiatrist_name}
                        {p.psychiatrist_phone && <span className="text-muted-foreground"> · {p.psychiatrist_phone}</span>}
                      </p>
                    </div>
                  )}
                  {p.medications && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Medicações</p>
                      <p className="text-foreground whitespace-pre-line">{p.medications}</p>
                    </div>
                  )}
                  {p.notes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--accent))]">Observações</p>
                      <p className="text-foreground whitespace-pre-line">{p.notes}</p>
                    </div>
                  )}
                </div>
              )}
              {/* WhatsApp billing button */}
              {p.phone && (
                <div className="mt-3 border-t border-border/50 pt-3">
                  {(() => {
                    const url = buildWhatsAppUrl(p);
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                        onClick={() => {
                          if (!pixKey) {
                            toast.info("Dica: cadastre sua chave Pix no Perfil para incluí-la automaticamente na mensagem de cobrança.");
                          }
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Cobrar via WhatsApp
                      </a>
                    ) : null;
                  })()}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => setHistoryPatient(p)}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Histórico de Sessões
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => setRecordsPatient(p)}
                >
                  <FileText className="h-3.5 w-3.5" /> Registros de Sessão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => setMoodPatient(p)}
                >
                  <Smile className="h-3.5 w-3.5" /> Humor
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  Visível ao supervisor
                </div>
                <Switch
                  checked={p.shared_with_supervisor}
                  onCheckedChange={() => toggleSharing(p)}
                  aria-label="Compartilhar com supervisor"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* TCC Record Dialog */}
      <Dialog open={!!tccPatient} onOpenChange={(o) => !o && setTccPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{tccPatient?.full_name}</DialogTitle>
            <DialogDescription>Prontuário TCC — Registro de Pensamento</DialogDescription>
          </DialogHeader>
          {tccPatient && <TccRecords patientId={tccPatient.id} />}
        </DialogContent>
      </Dialog>

      {/* Padesky Formulation Dialog */}
      <Dialog open={!!padeksyPatient} onOpenChange={(o) => !o && setPadeksyPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto [&_textarea]:scroll-mt-24 [&_input]:scroll-mt-24">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{padeksyPatient?.full_name}</DialogTitle>
            <DialogDescription>Formulação de Caso — Modelo Padesky</DialogDescription>
          </DialogHeader>
          {padeksyPatient && <CaseFormulation patientId={padeksyPatient.id} />}
        </DialogContent>
      </Dialog>

      {/* Session History Dialog */}
      <Dialog open={!!historyPatient} onOpenChange={(o) => !o && setHistoryPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{historyPatient?.full_name}</DialogTitle>
            <DialogDescription>Histórico de sessões e evolução do humor</DialogDescription>
          </DialogHeader>
          {historyPatient && <PatientSessionHistory patientId={historyPatient.id} patientName={historyPatient.full_name} />}
        </DialogContent>
      </Dialog>

      {/* Session Records Dialog */}
      <Dialog open={!!recordsPatient} onOpenChange={(o) => !o && setRecordsPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{recordsPatient?.full_name}</DialogTitle>
            <DialogDescription>Registros de sessão (prontuário clínico)</DialogDescription>
          </DialogHeader>
          {recordsPatient && <PatientSessionRecords patientId={recordsPatient.id} patientName={recordsPatient.full_name} />}
        </DialogContent>
      </Dialog>

      {/* Mood Chart Dialog */}
      <Dialog open={!!moodPatient} onOpenChange={(o) => !o && setMoodPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{moodPatient?.full_name}</DialogTitle>
            <DialogDescription>Evolução do humor ao longo do tempo</DialogDescription>
          </DialogHeader>
          {moodPatient && <PatientMoodChart patientId={moodPatient.id} patientName={moodPatient.full_name} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!anamnesisPatient} onOpenChange={(o) => !o && setAnamnesisPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{anamnesisPatient?.full_name}</DialogTitle>
            <DialogDescription>Anamnese — Informações do paciente criança</DialogDescription>
          </DialogHeader>
          {anamnesisPatient && (
            <ChildAnamnesisForm
              patientId={anamnesisPatient.id}
              patientName={anamnesisPatient.full_name}
              onSaved={() => setAnamnesisPatient(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <PremiumGate open={gateOpen} onOpenChange={setGateOpen} />
      <UnsavedGuardDialog open={patientGuard.confirmOpen} onConfirm={patientGuard.confirmLeave} onCancel={patientGuard.cancelLeave} onSaveDraft={patientGuard.saveDraftAndLeave} />
    </div>
  );
};

export default Patients;
