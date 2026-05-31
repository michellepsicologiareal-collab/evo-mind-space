import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-psireal.png";

interface Clause {
  key: string;
  title: string;
  description: string;
  type: "agree" | "radio" | "text";
  options?: string[];
}

interface Template {
  id: string;
  user_id: string;
  professional_name: string;
  professional_crp: string;
  clauses: Clause[];
  lgpd_clause: string;
}

export default function ContratoPublico() {
  const { templateId } = useParams<{ templateId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);

  // Patient fields
  const [patientName, setPatientName] = useState("");
  const [patientWhatsapp, setPatientWhatsapp] = useState("");
  const [patientBirthDate, setPatientBirthDate] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [acceptedLgpd, setAcceptedLgpd] = useState(false);

  // Clause responses
  const [responses, setResponses] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      let tpl: Template | null = null;
      try {
        const url = `https://fdixnrqzoyuyeaqurfdx.supabase.co/functions/v1/public-contract?template_id=${encodeURIComponent(templateId)}`;
        const resp = await fetch(url);
        if (resp.ok) tpl = (await resp.json()) as Template;
      } catch {
        // ignore
      }
      if (tpl && tpl.id) {
        setTemplate(tpl);
        const init: Record<string, string | boolean> = {};
        (tpl.clauses || []).forEach((c) => {
          if (c.type === "text") return;
          init[c.key] = c.type === "agree" ? false : "";
        });
        setResponses(init);
      }
      setLoading(false);
    })();
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    // Validate all agree clauses are checked
    const allAgreed = template.clauses.every((c) => {
      if (c.type === "text") return true;
      if (c.type === "agree") return responses[c.key] === true;
      if (c.type === "radio") return !!responses[c.key];
      return true;
    });

    if (!allAgreed) {
      toast.error("Por favor, aceite todas as cláusulas antes de enviar.");
      return;
    }

    if (!acceptedLgpd) {
      toast.error("Você precisa aceitar a cláusula LGPD.");
      return;
    }

    if (!patientName.trim() || !patientCpf.trim()) {
      toast.error("Nome e CPF são obrigatórios.");
      return;
    }

    setSubmitting(true);

    // Build human-readable clause responses
    const readableResponses: Record<string, string> = {};
    template.clauses.forEach((c) => {
      if (c.type === "text") return;
      const val = responses[c.key];
      readableResponses[c.title] = c.type === "agree" ? "Aceito" : String(val);
    });

    const resp = await fetch(
      `https://fdixnrqzoyuyeaqurfdx.supabase.co/functions/v1/public-contract`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          patient_name: patientName.trim(),
          patient_whatsapp: patientWhatsapp.trim(),
          patient_birth_date: patientBirthDate || null,
          patient_cpf: patientCpf.trim(),
          patient_address: patientAddress.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_relationship: emergencyRelationship.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          clause_responses: readableResponses,
          accepted_lgpd: true,
        }),
      },
    );
    const error = !resp.ok;

    setSubmitting(false);

    if (error) {
      toast.error("Erro ao enviar contrato. Tente novamente.");
    } else {
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Contrato não encontrado.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-md">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-display font-bold">Contrato aceito com sucesso!</h1>
          <p className="text-muted-foreground">
            Obrigado, {patientName}. Seu termo de adesão foi registrado e enviado ao(à) profissional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src={logo} alt="Psi Real" className="h-10 w-10 rounded-full" />
          </div>
          <h1 className="text-2xl font-display font-bold">Termo de Adesão ao Tratamento</h1>
        </div>

        {/* Contratada (Profissional) */}
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contratada (Profissional)</h2>
          <p className="text-sm"><strong>{template.professional_name || "—"}</strong></p>
          {template.professional_crp && <p className="text-sm text-muted-foreground">CRP: {template.professional_crp}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Clauses */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-lg">Condições para Aceite</h2>
            {template.clauses.map((clause, index) => (
              <div key={clause.key} className="border rounded-xl p-4 bg-card space-y-2">
                <p className="font-semibold text-sm">
                  {index + 1}) {clause.title}
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{clause.description}</p>

                {clause.type === "agree" && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <Checkbox
                      checked={responses[clause.key] === true}
                      onCheckedChange={(checked) =>
                        setResponses((prev) => ({ ...prev, [clause.key]: !!checked }))
                      }
                    />
                    <span className="text-sm">Estou de acordo com os termos citados</span>
                  </label>
                )}

                {clause.type === "radio" && clause.options && (
                  <RadioGroup
                    value={String(responses[clause.key] || "")}
                    onValueChange={(v) =>
                      setResponses((prev) => ({ ...prev, [clause.key]: v }))
                    }
                    className="mt-2 space-y-1"
                  >
                    {clause.options.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value={opt} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                )}

                {/* "text" type = display only, no interaction needed */}
              </div>
            ))}
          </div>

          {/* Patient data */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-lg">Contratante (Paciente)</h2>
            <p className="text-xs text-muted-foreground">Pessoa física que solicita e receberá os serviços de psicologia.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={patientWhatsapp} onChange={(e) => setPatientWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={patientBirthDate} onChange={(e) => setPatientBirthDate(e.target.value)} />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input value={patientCpf} onChange={(e) => setPatientCpf(e.target.value)} placeholder="000.000.000-00" required />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço (Rua, Bairro, Cidade, Estado)</Label>
                <Input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Emergency contact */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-lg">Contato de Emergência</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome do contato</Label>
                <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
              </div>
              <div>
                <Label>Grau de parentesco</Label>
                <Input value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Telefone e e-mail</Label>
                <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* LGPD */}
          <div className="border rounded-xl p-4 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">Proteção de Dados (LGPD)</h3>
            </div>
            <p className="text-sm text-muted-foreground">{template.lgpd_clause}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={acceptedLgpd}
                onCheckedChange={(checked) => setAcceptedLgpd(!!checked)}
              />
              <span className="text-sm">Li e aceito os termos de proteção de dados</span>
            </label>
          </div>

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Aceitar e Enviar
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Psi Real • Os dados são protegidos conforme LGPD
        </p>
      </div>
    </div>
  );
}
