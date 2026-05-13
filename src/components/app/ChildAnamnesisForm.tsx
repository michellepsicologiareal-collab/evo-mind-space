import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Save, Cloud, CheckCircle2, FileEdit } from "lucide-react";

interface Props {
  patientId: string;
  patientName: string;
  onSaved?: () => void;
}

type Form = {
  email: string;
  child_name: string;
  child_birth_date: string;
  schooling: string;
  sleep: string;
  feeding: string;
  sexual_curiosity: string;
  relationship_father: string;
  relationship_mother: string;
  social_relationship: string;
  school_relationship: string;
  chief_complaint: string;
  was_desired: string;
  parents_kinship: string;
  pregnancy_health_issue: string;
  pregnancy_health_which: string;
  mother_name: string;
  mother_schooling: string;
  mother_profession: string;
  father_name: string;
  father_schooling: string;
  father_profession: string;
  weeks_at_birth: string;
  delivery_type: string;
  has_disease: string;
  parents_living_together: string;
  parents_relationship: string;
  parents_disorder: string;
  parents_disorder_which: string;
  authorized_lgpd: boolean;
};

const empty: Form = {
  email: "", child_name: "", child_birth_date: "", schooling: "", sleep: "",
  feeding: "", sexual_curiosity: "", relationship_father: "", relationship_mother: "",
  social_relationship: "", school_relationship: "", chief_complaint: "",
  was_desired: "", parents_kinship: "", pregnancy_health_issue: "",
  pregnancy_health_which: "", mother_name: "", mother_schooling: "",
  mother_profession: "", father_name: "", father_schooling: "", father_profession: "",
  weeks_at_birth: "", delivery_type: "", has_disease: "",
  parents_living_together: "", parents_relationship: "", parents_disorder: "",
  parents_disorder_which: "", authorized_lgpd: false,
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm text-foreground/80">{label}</Label>
    {children}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border bg-background/50 p-4 sm:p-5 space-y-4">
    <h3 className="font-display text-lg font-medium text-foreground">{title}</h3>
    {children}
  </section>
);

const draftKey = (patientId: string) => `anamnese_crianca_rascunho_${patientId}`;

export const ChildAnamnesisForm = ({ patientId, patientName, onSaved }: Props) => {
  const { user } = useAuth();
  const [form, setForm] = useState<Form>({ ...empty, child_name: patientName });
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const initialLoadRef = useRef(true);
  const debounceRef = useRef<number | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  // Initial load: prefer the more recent of (DB record) vs (localStorage draft)
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("child_anamneses")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;

      let dbForm: Form | null = null;
      let dbUpdatedAt: number = 0;
      if (data) {
        const d = data as any;
        setRecordId(d.id);
        dbUpdatedAt = new Date(d.updated_at ?? d.created_at).getTime();
        dbForm = {
          email: d.email ?? "",
          child_name: d.child_name ?? patientName,
          child_birth_date: d.child_birth_date ?? "",
          schooling: d.schooling ?? "",
          sleep: d.sleep ?? "",
          feeding: d.feeding ?? "",
          sexual_curiosity: d.sexual_curiosity ?? "",
          relationship_father: d.relationship_father ?? "",
          relationship_mother: d.relationship_mother ?? "",
          social_relationship: d.social_relationship ?? "",
          school_relationship: d.school_relationship ?? "",
          chief_complaint: d.chief_complaint ?? "",
          was_desired: d.was_desired ?? "",
          parents_kinship: d.parents_kinship ?? "",
          pregnancy_health_issue: d.pregnancy_health_issue ?? "",
          pregnancy_health_which: d.pregnancy_health_which ?? "",
          mother_name: d.mother_name ?? "",
          mother_schooling: d.mother_schooling ?? "",
          mother_profession: d.mother_profession ?? "",
          father_name: d.father_name ?? "",
          father_schooling: d.father_schooling ?? "",
          father_profession: d.father_profession ?? "",
          weeks_at_birth: d.weeks_at_birth ?? "",
          delivery_type: d.delivery_type ?? "",
          has_disease: d.has_disease ?? "",
          parents_living_together: d.parents_living_together ?? "",
          parents_relationship: d.parents_relationship ?? "",
          parents_disorder: d.parents_disorder ?? "",
          parents_disorder_which: d.parents_disorder_which ?? "",
          authorized_lgpd: !!d.authorized_lgpd,
        };
      }

      // Read draft
      let draftForm: Form | null = null;
      let draftSaved = 0;
      try {
        const raw = localStorage.getItem(draftKey(patientId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.form) {
            draftForm = parsed.form as Form;
            draftSaved = Number(parsed.savedAt ?? 0);
          }
        }
      } catch {}

      if (draftForm && draftSaved > dbUpdatedAt) {
        setForm(draftForm);
        setHasDraft(true);
        setDraftSavedAt(new Date(draftSaved));
        toast.info("Rascunho restaurado", { description: "Continuando de onde você parou." });
      } else if (dbForm) {
        setForm(dbForm);
      }

      // Allow auto-save effect to run after this initial load settles
      setTimeout(() => { initialLoadRef.current = false; }, 100);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [patientId, patientName]);

  // Debounced auto-save draft to localStorage on every change
  useEffect(() => {
    if (loading || initialLoadRef.current || !dirty) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      try {
        const now = Date.now();
        localStorage.setItem(
          draftKey(patientId),
          JSON.stringify({ form, savedAt: now }),
        );
        setDraftSavedAt(new Date(now));
        setHasDraft(true);
      } catch {}
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [form, dirty, loading, patientId]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey(patientId)); } catch {}
    setHasDraft(false);
    setDraftSavedAt(null);
  }, [patientId]);

  const discardDraft = useCallback(async () => {
    if (!confirm("Descartar o rascunho local e recarregar a versão salva?")) return;
    clearDraft();
    setDirty(false);
    initialLoadRef.current = true;
    // re-trigger initial load by toggling loading
    setLoading(true);
    const { data } = await supabase
      .from("child_anamneses")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setRecordId(d.id);
      setForm({
        ...empty,
        child_name: d.child_name ?? patientName,
        ...Object.fromEntries(Object.keys(empty).map((k) => [k, (d as any)[k] ?? (empty as any)[k]])) as any,
        child_birth_date: d.child_birth_date ?? "",
        authorized_lgpd: !!d.authorized_lgpd,
      });
    } else {
      setForm({ ...empty, child_name: patientName });
    }
    setTimeout(() => { initialLoadRef.current = false; }, 100);
    setLoading(false);
    toast.success("Rascunho descartado");
  }, [patientId, patientName, clearDraft]);

  const save = useCallback(async () => {
    if (!user) return;
    if (!form.authorized_lgpd) {
      toast.error("É necessário autorizar o uso dos dados (LGPD).");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      child_birth_date: form.child_birth_date || null,
      user_id: user.id,
      patient_id: patientId,
    };
    let error;
    if (recordId) {
      ({ error } = await supabase.from("child_anamneses").update(payload).eq("id", recordId));
    } else {
      const res = await supabase.from("child_anamneses").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setRecordId(res.data.id);
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar anamnese");
      return;
    }
    clearDraft();
    setDirty(false);
    toast.success("Anamnese finalizada e salva");
    onSaved?.();
  }, [form, user, recordId, patientId, onSaved, clearDraft]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-hero p-5 text-primary-foreground">
        <h2 className="font-display text-xl font-medium">Bem-vindo a um Espaço de Cuidado Psicológico! 🌿</h2>
        <p className="mt-2 text-sm opacity-95">
          Querido(a) cuidador, é com imensa alegria que te dou as boas-vindas a este espaço de cuidado psicológico.
          Entendendo o quão vital é o seu papel e o quanto você se dedica ao que precisa de você, este é um lugar
          onde você encontrará apoio, compreensão e acolhimento.
        </p>
        <p className="mt-2 text-sm opacity-95">
          Estou aqui para caminhar ao seu lado, ouvir suas preocupações e auxiliá-lo(a) da melhor maneira possível.
          Por favor, sinta-se à vontade para compartilhar suas experiências e confie que estou aqui para ajudar.
          O seu bem-estar também é importante, e estou comprometido(a) em cuidar de você e de nossa criança nesse processo!
        </p>
        <p className="mt-2 text-sm opacity-95">Seja bem-vindo(a) e saiba que estamos juntos nessa jornada.</p>
      </div>

      {/* Status do rascunho */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {!recordId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lilac/20 text-lilac-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              <FileEdit className="h-3 w-3" /> Rascunho
            </span>
          )}
          {recordId && dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 text-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              <FileEdit className="h-3 w-3" /> Alterações não salvas
            </span>
          )}
          {recordId && !dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              <CheckCircle2 className="h-3 w-3" /> Finalizada
            </span>
          )}
          {draftSavedAt ? (
            <span className="inline-flex items-center gap-1">
              <Cloud className="h-3 w-3" /> Rascunho salvo automaticamente às {draftSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span>Salvamento automático ativado</span>
          )}
        </div>
        {hasDraft && (
          <button type="button" onClick={discardDraft} className="text-muted-foreground hover:text-destructive underline-offset-2 hover:underline">
            Descartar rascunho
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">* Indica uma pergunta obrigatória</p>

      <Section title="Sobre a criança 🌿">
        <Field label="E-mail *">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Nome da criança *">
          <Input value={form.child_name} onChange={(e) => set("child_name", e.target.value)} />
        </Field>
        <Field label="Data de nascimento da criança *">
          <Input type="date" value={form.child_birth_date} onChange={(e) => set("child_birth_date", e.target.value)} />
        </Field>
        <Field label="Escolaridade *">
          <Input value={form.schooling} onChange={(e) => set("schooling", e.target.value)} />
        </Field>
        <Field label="Dorme bem? *">
          <Textarea value={form.sleep} onChange={(e) => set("sleep", e.target.value)} />
        </Field>
        <Field label="Como é a alimentação da criança? *">
          <Textarea value={form.feeding} onChange={(e) => set("feeding", e.target.value)} />
        </Field>
        <Field label="Apresentou ou apresenta curiosidade sexual? *">
          <Textarea value={form.sexual_curiosity} onChange={(e) => set("sexual_curiosity", e.target.value)} />
        </Field>
        <Field label="Descrever como é o relacionamento do paciente com o pai: *">
          <Textarea value={form.relationship_father} onChange={(e) => set("relationship_father", e.target.value)} />
        </Field>
        <Field label="Descrever como é o relacionamento do paciente com a mãe: *">
          <Textarea value={form.relationship_mother} onChange={(e) => set("relationship_mother", e.target.value)} />
        </Field>
        <Field label="Como se relaciona com as pessoas de seu convívio social? *">
          <Textarea value={form.social_relationship} onChange={(e) => set("social_relationship", e.target.value)} />
        </Field>
        <Field label="Como se relaciona na escola? *">
          <Textarea value={form.school_relationship} onChange={(e) => set("school_relationship", e.target.value)} />
        </Field>
        <Field label="Qual a queixa principal em relação à criança? *">
          <Textarea value={form.chief_complaint} onChange={(e) => set("chief_complaint", e.target.value)} />
        </Field>
      </Section>

      <Section title="Gestação">
        <Field label="A criança foi desejada? *">
          <Textarea value={form.was_desired} onChange={(e) => set("was_desired", e.target.value)} />
        </Field>
        <Field label="Existe parentesco entre os pais? *">
          <Textarea value={form.parents_kinship} onChange={(e) => set("parents_kinship", e.target.value)} />
        </Field>
        <Field label="Teve algum problema de saúde durante a gravidez? *">
          <Textarea value={form.pregnancy_health_issue} onChange={(e) => set("pregnancy_health_issue", e.target.value)} />
        </Field>
        <Field label="Quais? *">
          <Textarea value={form.pregnancy_health_which} onChange={(e) => set("pregnancy_health_which", e.target.value)} />
        </Field>
      </Section>

      <Section title="Dados dos cuidadores">
        <Field label="Nome da mãe da criança *">
          <Input value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} />
        </Field>
        <Field label="Escolaridade da mãe *">
          <Input value={form.mother_schooling} onChange={(e) => set("mother_schooling", e.target.value)} />
        </Field>
        <Field label="Profissão da mãe *">
          <Input value={form.mother_profession} onChange={(e) => set("mother_profession", e.target.value)} />
        </Field>
        <Field label="Nome do pai da criança *">
          <Input value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
        </Field>
        <Field label="Escolaridade do pai *">
          <Input value={form.father_schooling} onChange={(e) => set("father_schooling", e.target.value)} />
        </Field>
        <Field label="Profissão do pai *">
          <Input value={form.father_profession} onChange={(e) => set("father_profession", e.target.value)} />
        </Field>
        <Field label="A criança nasceu de quantas semanas? *">
          <Input value={form.weeks_at_birth} onChange={(e) => set("weeks_at_birth", e.target.value)} />
        </Field>
        <Field label="O parto foi qual tipo: *">
          <Input value={form.delivery_type} onChange={(e) => set("delivery_type", e.target.value)} />
        </Field>
        <Field label="A criança possui alguma doença? *">
          <Textarea value={form.has_disease} onChange={(e) => set("has_disease", e.target.value)} />
        </Field>
        <Field label="Os pais vivem juntos? *">
          <Input value={form.parents_living_together} onChange={(e) => set("parents_living_together", e.target.value)} />
        </Field>
        <Field label="Como é o relacionamento dos pais? *">
          <Textarea value={form.parents_relationship} onChange={(e) => set("parents_relationship", e.target.value)} />
        </Field>
        <Field label="Algum dos pais possui algum transtorno psicológico diagnosticado por um médico? *">
          <Textarea value={form.parents_disorder} onChange={(e) => set("parents_disorder", e.target.value)} />
        </Field>
        <Field label="Cite qual.">
          <Textarea value={form.parents_disorder_which} onChange={(e) => set("parents_disorder_which", e.target.value)} />
        </Field>
      </Section>

      <Section title="Autorização">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={form.authorized_lgpd} onCheckedChange={(c) => set("authorized_lgpd", !!c)} className="mt-1" />
          <span className="text-sm text-foreground/80">
            Declaro que autorizo o uso das informações fornecidas neste formulário para os fins exclusivos do
            processo terapêutico, conforme estabelecido pela Lei Geral de Proteção de Dados (LGPD), garantindo a
            confidencialidade e segurança dos meus dados pessoais. *
          </span>
        </label>
      </Section>

      <div className="rounded-2xl bg-secondary/40 p-4 text-sm text-muted-foreground italic">
        Com carinho e compreensão,<br />
        Michelle Donegá dos Santos 🌿❣️<br />
        CRP 93008
      </div>

      <div className="flex flex-wrap justify-end items-center gap-2 sticky bottom-0 bg-background/95 backdrop-blur py-3 -mx-1 px-1">
        <span className="text-xs text-muted-foreground mr-auto">
          {dirty ? "Alterações em rascunho local" : recordId ? "Tudo salvo" : "Pronto para finalizar"}
        </span>
        <Button variant="accent" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {recordId ? "Salvar alteração" : "Finalizar anamnese"}
        </Button>
      </div>
    </div>
  );
};
