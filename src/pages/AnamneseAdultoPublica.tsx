import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, ShieldCheck, Cloud, Heart, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-psireal.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/public-adult-anamnesis`;

const SYMPTOMS = [
  "Ansiedade","Preocupação excessiva","Tristeza","Desânimo","Irritabilidade","Medo",
  "Crises de pânico","Dificuldade para dormir","Cansaço constante",
  "Dificuldade de concentração","Alterações na alimentação","Estresse",
];

type Form = {
  full_name: string; birth_date: string; phone: string; email: string;
  profession: string; marital_status: string;
  emergency_contact_name: string; emergency_contact_phone: string;

  reason_for_seeking: string;
  problem_duration: string;
  impact_level: number;

  symptoms: string[]; symptom_other: string;

  uses_medication: string; medication_name: string;
  had_psychotherapy: string; had_psychiatrist: string;

  scale_sleep: number; scale_feeding: number; scale_work: number;
  scale_relationships: number; scale_leisure: number; scale_physical_health: number;

  support_network: string; support_network_details: string;

  important_events: string; therapy_goals: string; additional_info: string;

  risk_ideation: "" | "none" | "sometimes" | "frequent";
};

const empty: Form = {
  full_name: "", birth_date: "", phone: "", email: "", profession: "", marital_status: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  reason_for_seeking: "", problem_duration: "", impact_level: 5,
  symptoms: [], symptom_other: "",
  uses_medication: "", medication_name: "", had_psychotherapy: "", had_psychiatrist: "",
  scale_sleep: 5, scale_feeding: 5, scale_work: 5, scale_relationships: 5, scale_leisure: 5, scale_physical_health: 5,
  support_network: "", support_network_details: "",
  important_events: "", therapy_goals: "", additional_info: "",
  risk_ideation: "",
};

const draftKey = (t: string) => `psireal_anamnese_adulto_${t}`;

const Section = ({
  title, subtitle, children, refEl,
}: { title: string; subtitle?: string; children: React.ReactNode; refEl?: React.RefObject<HTMLDivElement> }) => (
  <section
    ref={refEl}
    className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 scroll-mt-28"
  >
    <div>
      <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm text-foreground/80">
      {label}{required && <span className="text-destructive"> *</span>}
    </Label>
    {children}
  </div>
);

const ScaleRow = ({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="text-sm">{label}</Label>
      <span className="font-display text-lg font-semibold text-primary tabular-nums w-8 text-right">{value}</span>
    </div>
    <Slider min={0} max={10} step={1} value={[value]} onValueChange={(v) => onChange(v[0] ?? 0)} />
  </div>
);

export default function AnamneseAdultoPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [form, setForm] = useState<Form>(empty);
  const [acceptedLgpd, setAcceptedLgpd] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const sectionRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({
    s1: useRef<HTMLDivElement>(null), s2: useRef<HTMLDivElement>(null),
    s3: useRef<HTMLDivElement>(null), s4: useRef<HTMLDivElement>(null),
    s5: useRef<HTMLDivElement>(null), s6: useRef<HTMLDivElement>(null),
    s7: useRef<HTMLDivElement>(null), s8: useRef<HTMLDivElement>(null),
    s9: useRef<HTMLDivElement>(null), s10: useRef<HTMLDivElement>(null),
    s11: useRef<HTMLDivElement>(null), s12: useRef<HTMLDivElement>(null),
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  // Carregar convite
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${ENDPOINT}?token=${token}`, {
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(data?.error || "Link de anamnese inválido ou expirado.");
          return;
        }
        setProfessionalName(data.professional_name || "");
        // Carregar rascunho
        const saved = localStorage.getItem(draftKey(token));
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setForm((p) => ({ ...p, ...parsed }));
          } catch { /* noop */ }
        } else if (data.patient_name) {
          setForm((p) => ({ ...p, full_name: data.patient_name }));
        }
      } catch {
        setErrorMsg("Não foi possível carregar o formulário.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Autosave
  useEffect(() => {
    if (!token || loading) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(token), JSON.stringify(form));
        setSavedAt(new Date());
      } catch { /* noop */ }
    }, 600);
    return () => clearTimeout(id);
  }, [form, token, loading]);

  // Progress
  const progress = useMemo(() => {
    const checks: boolean[] = [
      !!form.full_name.trim(),
      !!form.birth_date || !!form.phone || !!form.email,
      !!form.profession || !!form.marital_status,
      !!form.emergency_contact_name,
      form.reason_for_seeking.trim().length >= 5,
      !!form.problem_duration,
      form.impact_level >= 0,
      form.symptoms.length > 0 || !!form.symptom_other,
      !!form.uses_medication,
      !!form.had_psychotherapy,
      !!form.had_psychiatrist,
      form.scale_sleep >= 0,
      !!form.support_network,
      !!form.therapy_goals || !!form.important_events,
      !!form.risk_ideation,
      acceptedLgpd,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [form, acceptedLgpd]);

  const toggleSymptom = (s: string, checked: boolean) => {
    setForm((p) => ({
      ...p,
      symptoms: checked ? [...p.symptoms, s] : p.symptoms.filter((x) => x !== s),
    }));
  };

  const scrollTo = (k: string) => {
    sectionRefs.current[k]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error("Informe seu nome completo."); scrollTo("s1"); return; }
    if (!form.risk_ideation) { toast.error("Responda à pergunta de segurança."); scrollTo("s12"); return; }
    if (!acceptedLgpd) { toast.error("É necessário autorizar o uso dos dados (LGPD)."); return; }

    setSubmitting(true);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        token,
        authorized_lgpd: true,
        ...form,
        impact_level: String(form.impact_level),
        scale_sleep: String(form.scale_sleep),
        scale_feeding: String(form.scale_feeding),
        scale_work: String(form.scale_work),
        scale_relationships: String(form.scale_relationships),
        scale_leisure: String(form.scale_leisure),
        scale_physical_health: String(form.scale_physical_health),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data?.error || "Erro ao enviar. Tente novamente.");
      return;
    }
    if (token) localStorage.removeItem(draftKey(token));
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-muted-foreground text-center max-w-md">{errorMsg}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">Sua anamnese foi enviada com sucesso.</h1>
          <p className="text-muted-foreground">
            Muito obrigado pelo preenchimento. Essas informações ajudarão sua psicóloga a compreender melhor
            sua história e tornar a primeira sessão mais produtiva.
          </p>
          <p className="text-sm text-muted-foreground">
            Caso precise atualizar alguma informação, converse durante o atendimento.
          </p>
        </div>
      </div>
    );
  }

  const riskFlag = form.risk_ideation === "sometimes" || form.risk_ideation === "frequent";

  return (
    <div className="min-h-screen bg-background">
      {/* Progress fixo */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Preenchimento</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {savedAt && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Cloud className="h-3 w-3" /> Rascunho salvo automaticamente
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src={logo} alt="Psi Real" className="h-12 w-12 rounded-full" />
          </div>
          <h1 className="text-2xl font-display font-bold">Anamnese Inicial — Adulto</h1>
          {professionalName && (
            <p className="text-sm text-muted-foreground">para {professionalName}</p>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-hero p-5 text-primary-foreground">
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-display text-lg font-medium">Bem-vindo(a) a este espaço de cuidado 🌿</h2>
              <p className="mt-2 text-sm opacity-95">
                Responder essas perguntas ajuda sua psicóloga a conhecer sua história antes da primeira sessão.
                Fique à vontade — não existe resposta certa ou errada, e seu formulário salva sozinho enquanto você escreve.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* 1 */}
          <Section title="1. Dados pessoais" refEl={sectionRefs.current.s1}>
            <Field label="Nome completo" required>
              <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Data de nascimento"><Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Profissão"><Input value={form.profession} onChange={(e) => set("profession", e.target.value)} /></Field>
              <Field label="Estado civil"><Input value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Contato de emergência"><Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} /></Field>
              <Field label="Telefone do contato"><Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} /></Field>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => scrollTo("s2")}>Continuar</Button>
            </div>
          </Section>

          {/* 2 */}
          <Section title="2. Motivo da procura" refEl={sectionRefs.current.s2}>
            <Field label="O que fez você procurar terapia neste momento?">
              <Textarea rows={4} value={form.reason_for_seeking} onChange={(e) => set("reason_for_seeking", e.target.value)} />
            </Field>
          </Section>

          {/* 3 */}
          <Section title="3. Tempo do problema" refEl={sectionRefs.current.s3}>
            <RadioGroup value={form.problem_duration} onValueChange={(v) => set("problem_duration", v)} className="space-y-2">
              {[
                { v: "<1m", l: "Menos de 1 mês" },
                { v: "1_6m", l: "1 a 6 meses" },
                { v: "6_12m", l: "6 meses a 1 ano" },
                { v: ">1y", l: "Mais de 1 ano" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} id={`pd-${o.v}`} />
                  <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
          </Section>

          {/* 4 */}
          <Section title="4. Impacto na sua vida" subtitle="Quanto esse problema interfere na sua vida atualmente?" refEl={sectionRefs.current.s4}>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Não interfere</span>
                <span className="font-display text-3xl font-semibold text-primary tabular-nums">{form.impact_level}</span>
                <span className="text-xs text-muted-foreground">Interfere completamente</span>
              </div>
              <Slider min={0} max={10} step={1} value={[form.impact_level]} onValueChange={(v) => set("impact_level", v[0] ?? 0)} />
            </div>
          </Section>

          {/* 5 */}
          <Section title="5. Sintomas" subtitle="Marque os que você percebe com frequência." refEl={sectionRefs.current.s5}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYMPTOMS.map((s) => (
                <label key={s} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-2.5 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={form.symptoms.includes(s)} onCheckedChange={(c) => toggleSymptom(s, !!c)} />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </div>
            <Field label="Outro (descreva)">
              <Input value={form.symptom_other} onChange={(e) => set("symptom_other", e.target.value)} placeholder="Opcional" />
            </Field>
          </Section>

          {/* 6 */}
          <Section title="6. Tratamentos anteriores" refEl={sectionRefs.current.s6}>
            <Field label="Você faz uso de medicação?">
              <RadioGroup value={form.uses_medication} onValueChange={(v) => set("uses_medication", v)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" /> <span className="text-sm">Não</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /> <span className="text-sm">Sim</span></label>
              </RadioGroup>
            </Field>
            {form.uses_medication === "yes" && (
              <Field label="Qual medicamento?">
                <Input value={form.medication_name} onChange={(e) => set("medication_name", e.target.value)} />
              </Field>
            )}
            <Field label="Já realizou psicoterapia?">
              <RadioGroup value={form.had_psychotherapy} onValueChange={(v) => set("had_psychotherapy", v)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="never" /> <span className="text-sm">Nunca</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /> <span className="text-sm">Sim</span></label>
              </RadioGroup>
            </Field>
            <Field label="Já passou com psiquiatra?">
              <RadioGroup value={form.had_psychiatrist} onValueChange={(v) => set("had_psychiatrist", v)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="never" /> <span className="text-sm">Nunca</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /> <span className="text-sm">Sim</span></label>
              </RadioGroup>
            </Field>
          </Section>

          {/* 7 */}
          <Section title="7. Como está sua vida hoje" subtitle="Avalie cada área de 0 a 10." refEl={sectionRefs.current.s7}>
            <ScaleRow label="Sono" value={form.scale_sleep} onChange={(v) => set("scale_sleep", v)} />
            <ScaleRow label="Alimentação" value={form.scale_feeding} onChange={(v) => set("scale_feeding", v)} />
            <ScaleRow label="Trabalho ou estudos" value={form.scale_work} onChange={(v) => set("scale_work", v)} />
            <ScaleRow label="Relacionamentos" value={form.scale_relationships} onChange={(v) => set("scale_relationships", v)} />
            <ScaleRow label="Lazer" value={form.scale_leisure} onChange={(v) => set("scale_leisure", v)} />
            <ScaleRow label="Saúde física" value={form.scale_physical_health} onChange={(v) => set("scale_physical_health", v)} />
          </Section>

          {/* 8 */}
          <Section title="8. Rede de apoio" refEl={sectionRefs.current.s8}>
            <Field label="Você sente que possui pessoas com quem pode contar?">
              <RadioGroup value={form.support_network} onValueChange={(v) => set("support_network", v)} className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /> <span className="text-sm">Sim</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" /> <span className="text-sm">Não</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="sometimes" /> <span className="text-sm">Às vezes</span></label>
              </RadioGroup>
            </Field>
            <Field label="Se desejar, conte quem faz parte da sua rede de apoio.">
              <Textarea rows={3} value={form.support_network_details} onChange={(e) => set("support_network_details", e.target.value)} />
            </Field>
          </Section>

          {/* 9 */}
          <Section title="9. Eventos importantes" refEl={sectionRefs.current.s9}>
            <Field label="Houve algum acontecimento importante que possa estar relacionado ao momento que está vivendo?">
              <Textarea rows={4} value={form.important_events} onChange={(e) => set("important_events", e.target.value)} />
            </Field>
          </Section>

          {/* 10 */}
          <Section title="10. Objetivos" refEl={sectionRefs.current.s10}>
            <Field label="O que você espera conquistar com a terapia?">
              <Textarea rows={3} value={form.therapy_goals} onChange={(e) => set("therapy_goals", e.target.value)} />
            </Field>
          </Section>

          {/* 11 */}
          <Section title="11. Informações adicionais" refEl={sectionRefs.current.s11}>
            <Field label="Existe algo importante que gostaria que sua psicóloga soubesse antes da primeira sessão?">
              <Textarea rows={3} value={form.additional_info} onChange={(e) => set("additional_info", e.target.value)} />
            </Field>
          </Section>

          {/* 12 */}
          <Section
            title="12. Segurança"
            subtitle="Essa resposta é sigilosa e só a sua psicóloga verá."
            refEl={sectionRefs.current.s12}
          >
            <Field label="Nas últimas semanas você teve pensamentos de que a vida não vale a pena ou de machucar a si mesmo?" required>
              <RadioGroup value={form.risk_ideation} onValueChange={(v) => set("risk_ideation", v as Form["risk_ideation"])} className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="none" /> <span className="text-sm">Não</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="sometimes" /> <span className="text-sm">Algumas vezes</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="frequent" /> <span className="text-sm">Frequentemente</span></label>
              </RadioGroup>
            </Field>
            {riskFlag && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground/80">
                  Obrigado por compartilhar essa informação. Ela será vista apenas pela sua psicóloga e ajudará
                  a oferecer um atendimento mais seguro e adequado.
                </p>
              </div>
            )}
          </Section>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">Consentimento (LGPD)</h3>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox className="mt-0.5" checked={acceptedLgpd} onCheckedChange={(c) => setAcceptedLgpd(!!c)} />
              <span className="text-sm text-foreground/80">
                Declaro que as informações fornecidas são verdadeiras e autorizo seu armazenamento para fins de
                atendimento psicológico, conforme a Lei Geral de Proteção de Dados (LGPD).
              </span>
            </label>
          </div>

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting || !acceptedLgpd}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar Anamnese
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            Com carinho e compreensão • Powered by Psi Real
          </p>
        </form>
      </div>
    </div>
  );
}
