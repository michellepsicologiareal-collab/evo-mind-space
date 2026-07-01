import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-psireal.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/public-anamnesis`;

type Form = {
  email: string; child_name: string; child_birth_date: string; schooling: string;
  sleep: string; feeding: string; sexual_curiosity: string; relationship_father: string;
  relationship_mother: string; social_relationship: string; school_relationship: string;
  chief_complaint: string; was_desired: string; parents_kinship: string;
  pregnancy_health_issue: string; pregnancy_health_which: string; mother_name: string;
  mother_schooling: string; mother_profession: string; father_name: string;
  father_schooling: string; father_profession: string; weeks_at_birth: string;
  delivery_type: string; has_disease: string; parents_living_together: string;
  parents_relationship: string; parents_disorder: string; parents_disorder_which: string;
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
  parents_disorder_which: "",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm text-foreground/80">{label}</Label>
    {children}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
    <h3 className="font-display text-lg font-medium">{title}</h3>
    {children}
  </section>
);

export default function AnamnesePublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [form, setForm] = useState<Form>(empty);
  const [acceptedLgpd, setAcceptedLgpd] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

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
        setForm((p) => ({ ...p, child_name: data.child_name || "" }));
      } catch {
        setErrorMsg("Não foi possível carregar o formulário.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedLgpd) {
      toast.error("É necessário autorizar o uso dos dados (LGPD).");
      return;
    }
    if (!form.email.trim() || !form.child_name.trim()) {
      toast.error("Preencha ao menos o e-mail e o nome da criança.");
      return;
    }
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
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data?.error || "Erro ao enviar. Tente novamente.");
      return;
    }
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
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-2xl font-display font-bold">Anamnese enviada com sucesso! 🌿</h1>
          <p className="text-muted-foreground">
            Obrigado por compartilhar essas informações. {professionalName ? `${professionalName} ` : "A profissional "}
            receberá tudo com carinho e em sigilo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src={logo} alt="Psi Real" className="h-10 w-10 rounded-full" />
          </div>
          <h1 className="text-2xl font-display font-bold">Anamnese — Informações da Criança</h1>
          {professionalName && (
            <p className="text-sm text-muted-foreground">para {professionalName}</p>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-hero p-5 text-primary-foreground">
          <h2 className="font-display text-lg font-medium">Bem-vindo(a) a um Espaço de Cuidado Psicológico! 🌿</h2>
          <p className="mt-2 text-sm opacity-95">
            Querido(a) cuidador, é com imensa alegria que te dou as boas-vindas a este espaço de cuidado psicológico.
            Por favor, sinta-se à vontade para compartilhar suas experiências — o seu bem-estar e o da criança são
            importantes nessa jornada.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">* Indica uma pergunta obrigatória</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <Section title="Sobre a criança 🌿">
            <Field label="E-mail *"><Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Nome da criança *"><Input required value={form.child_name} onChange={(e) => set("child_name", e.target.value)} /></Field>
            <Field label="Data de nascimento da criança *"><Input type="date" value={form.child_birth_date} onChange={(e) => set("child_birth_date", e.target.value)} /></Field>
            <Field label="Escolaridade *"><Input value={form.schooling} onChange={(e) => set("schooling", e.target.value)} /></Field>
            <Field label="Dorme bem? *"><Textarea value={form.sleep} onChange={(e) => set("sleep", e.target.value)} /></Field>
            <Field label="Como é a alimentação da criança? *"><Textarea value={form.feeding} onChange={(e) => set("feeding", e.target.value)} /></Field>
            <Field label="Apresentou ou apresenta curiosidade sexual? *"><Textarea value={form.sexual_curiosity} onChange={(e) => set("sexual_curiosity", e.target.value)} /></Field>
            <Field label="Descrever como é o relacionamento do paciente com o pai: *"><Textarea value={form.relationship_father} onChange={(e) => set("relationship_father", e.target.value)} /></Field>
            <Field label="Descrever como é o relacionamento do paciente com a mãe: *"><Textarea value={form.relationship_mother} onChange={(e) => set("relationship_mother", e.target.value)} /></Field>
            <Field label="Como se relaciona com as pessoas de seu convívio social? *"><Textarea value={form.social_relationship} onChange={(e) => set("social_relationship", e.target.value)} /></Field>
            <Field label="Como se relaciona na escola? *"><Textarea value={form.school_relationship} onChange={(e) => set("school_relationship", e.target.value)} /></Field>
            <Field label="Qual a queixa principal em relação à criança? *"><Textarea value={form.chief_complaint} onChange={(e) => set("chief_complaint", e.target.value)} /></Field>
          </Section>

          <Section title="Gestação">
            <Field label="A criança foi desejada? *"><Textarea value={form.was_desired} onChange={(e) => set("was_desired", e.target.value)} /></Field>
            <Field label="Existe parentesco entre os pais? *"><Textarea value={form.parents_kinship} onChange={(e) => set("parents_kinship", e.target.value)} /></Field>
            <Field label="Teve algum problema de saúde durante a gravidez? *"><Textarea value={form.pregnancy_health_issue} onChange={(e) => set("pregnancy_health_issue", e.target.value)} /></Field>
            <Field label="Quais? *"><Textarea value={form.pregnancy_health_which} onChange={(e) => set("pregnancy_health_which", e.target.value)} /></Field>
          </Section>

          <Section title="Dados dos cuidadores">
            <Field label="Nome da mãe da criança *"><Input value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} /></Field>
            <Field label="Escolaridade da mãe *"><Input value={form.mother_schooling} onChange={(e) => set("mother_schooling", e.target.value)} /></Field>
            <Field label="Profissão da mãe *"><Input value={form.mother_profession} onChange={(e) => set("mother_profession", e.target.value)} /></Field>
            <Field label="Nome do pai da criança *"><Input value={form.father_name} onChange={(e) => set("father_name", e.target.value)} /></Field>
            <Field label="Escolaridade do pai *"><Input value={form.father_schooling} onChange={(e) => set("father_schooling", e.target.value)} /></Field>
            <Field label="Profissão do pai *"><Input value={form.father_profession} onChange={(e) => set("father_profession", e.target.value)} /></Field>
            <Field label="A criança nasceu de quantas semanas? *"><Input value={form.weeks_at_birth} onChange={(e) => set("weeks_at_birth", e.target.value)} /></Field>
            <Field label="O parto foi qual tipo: *"><Input value={form.delivery_type} onChange={(e) => set("delivery_type", e.target.value)} /></Field>
            <Field label="A criança possui alguma doença? *"><Textarea value={form.has_disease} onChange={(e) => set("has_disease", e.target.value)} /></Field>
            <Field label="Os pais vivem juntos? *"><Input value={form.parents_living_together} onChange={(e) => set("parents_living_together", e.target.value)} /></Field>
            <Field label="Como é o relacionamento dos pais? *"><Textarea value={form.parents_relationship} onChange={(e) => set("parents_relationship", e.target.value)} /></Field>
            <Field label="Algum dos pais possui algum transtorno psicológico diagnosticado por um médico? *"><Textarea value={form.parents_disorder} onChange={(e) => set("parents_disorder", e.target.value)} /></Field>
            <Field label="Cite qual."><Textarea value={form.parents_disorder_which} onChange={(e) => set("parents_disorder_which", e.target.value)} /></Field>
          </Section>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">Autorização (LGPD)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Declaro que autorizo o uso das informações fornecidas neste formulário para os fins exclusivos do
              processo terapêutico, conforme estabelecido pela Lei Geral de Proteção de Dados (LGPD), garantindo
              a confidencialidade e segurança dos meus dados pessoais.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={acceptedLgpd} onCheckedChange={(c) => setAcceptedLgpd(!!c)} />
              <span className="text-sm">Li e autorizo conforme a LGPD *</span>
            </label>
          </div>

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar anamnese
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            Com carinho e compreensão • Powered by Psi Real
          </p>
        </form>
      </div>
    </div>
  );
}
