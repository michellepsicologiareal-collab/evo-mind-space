import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, FileText, Copy, ExternalLink, Plus, Trash2, Link2, FileCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { PageIntro } from "@/components/app/PageIntro";

interface Clause {
  key: string;
  title: string;
  description: string;
  type: "agree" | "radio" | "text";
  options?: string[];
}

const DEFAULT_CLAUSES: Clause[] = [
  {
    key: "cabecalho",
    title: "Considerações Iniciais",
    description: "Prezado(a) paciente, você está dando início a um acompanhamento psicoterápico na abordagem Cognitivo-Comportamental. Este tratamento será realizado 1 vez por semana e cada sessão terá duração de até 50 minutos. Havendo necessidade, a frequência de encontros semanais poderá ser aumentada ou espaçada, sendo isso previamente combinado entre você e sua terapeuta.\nO tempo de duração do acompanhamento psicoterápico é variável e dependerá dos seus objetivos, mas é importante destacar que esta modalidade de atendimento percorre determinados estágios visando a alta.\nÉ reservado ao paciente o direito de interromper o tratamento, por quaisquer razões, caso julgue necessário, sendo de sua inteira responsabilidade tal ato, bastando a comunicação prévia à terapeuta ou ao administrativo responsável.",
    type: "text",
  },
  {
    key: "local",
    title: "Local do Atendimento",
    description: "Consultório localizado na R. Júlio Zanoni, 67 - sala 9 ou atendimentos realizados por sistema online através de plataforma previamente combinada e respeitando as qualidades mínimas de sigilo (exemplo: local reservado, uso de fones de ouvido) e condições técnicas (câmera e conexão adequadas de internet).",
    type: "radio",
    options: ["Terapia on-line", "Terapia presencial"],
  },
  {
    key: "honorarios",
    title: "Honorários",
    description: "O valor da sessão será de acordo com o Plano de atendimento escolhido e o pagamento pode ser realizado através de pix.\nOs planos de atendimento compõem 4 sessões por mês. Em meses com mais de 5 semanas, será dividido o valor do pacote mensal por 4 e o resultado será acrescentado como uma sessão a mais no pacote mensal.\nO pagamento das sessões do mês deve ser efetuado de forma única e antecipada, antes do início das sessões do mês em questão. O valor total das sessões do mês corrente deve ser pago até o dia 5 do mês vigente.\nO valor da sessão sofrerá um reajuste anual, realizado no mês que iniciou a terapia, de acordo com os investimentos realizados pela terapeuta, informado com 30 dias de antecedência.\nPix: michelledonegas@gmail.com — Enviar comprovante a cada pagamento.",
    type: "agree",
  },
  {
    key: "duracao",
    title: "Duração",
    description: "Cada atendimento terá a duração de 50 (cinquenta) minutos em média, no horário combinado previamente. Em caso de atraso do paciente, não será possível estender esse período. Em caso de atraso do Terapeuta, esse tempo será compensado no mesmo dia ou outro a combinar.",
    type: "agree",
  },
  {
    key: "contatos_sessoes",
    title: "Contatos Entre as Sessões",
    description: "O paciente poderá enviar mensagens entre as consultas para tratar de dúvidas do tratamento, reservando-se o Terapeuta ao direito de responder em até 24 horas, desde que as dúvidas sejam pontuais e não se revistam de nova sessão de atendimento.",
    type: "agree",
  },
  {
    key: "urgencias",
    title: "Contatos de Urgências",
    description: "Em caso de urgência, o paciente poderá enviar mensagem (de texto) sinalizando a urgência ou ligar imediatamente para o número (11) 94738-8423. O Terapeuta irá responder com a máxima brevidade possível.",
    type: "agree",
  },
  {
    key: "sigilo",
    title: "Sigilo",
    description: "As informações trazidas às consultas serão mantidas em sigilo, com exceção das situações em que houver algum risco para si ou outros e haja a necessidade de informar um familiar ou responsável indicado pelo próprio paciente.",
    type: "agree",
  },
  {
    key: "duracao_tratamento",
    title: "Duração do Tratamento",
    description: "O tempo de tratamento irá variar dependendo do paciente e da natureza das questões a serem trabalhadas.",
    type: "agree",
  },
  {
    key: "dia_horario",
    title: "Dia e Horário",
    description: "Os dias e horários das sessões serão combinados com o paciente, podendo variar de acordo com as necessidades de adequação da agenda do psicólogo e demanda do paciente.",
    type: "agree",
  },
  {
    key: "desmarcacoes",
    title: "Desmarcações ou Mudanças de Horário",
    description: "Desmarcações ou mudanças de horário devem ser avisadas pelo paciente com 24h de antecedência. Caso não haja comparecimento sem aviso prévio, a sessão será cobrada. Quando avisadas com antecedência de 24h, a sessão poderá ser remarcada, desde que haja disponibilidade na agenda. Caso não haja disponibilidade, a sessão NÃO será cobrada. É possível remarcar no máximo uma sessão por mês.",
    type: "agree",
  },
  {
    key: "faltas",
    title: "Faltas",
    description: "Caso não haja comparecimento sem aviso prévio, a sessão será cobrada. A partir de duas faltas consecutivas sem aviso, o atendimento será considerado interrompido e o cliente poderá perder sua vaga preferencial de horário.",
    type: "agree",
  },
  {
    key: "rescisao",
    title: "Rescisão",
    description: "Fica assegurado ao paciente o direito de interromper o tratamento, por quaisquer razões, bastando a comunicação prévia à terapeuta. Fica assegurado também ao Terapeuta o direito de interromper o tratamento, bastando a comunicação prévia ao paciente e a indicação de um profissional para dar continuidade. Caso ocorram faltas injustificadas conforme previsto no item 10, o contrato restará rescindido.",
    type: "agree",
  },
  {
    key: "contato_emergencia",
    title: "Contato de Emergência",
    description: "O paciente concorda em fornecer as informações de contato de uma pessoa de confiança para ser contatada em caso de emergência. As informações incluirão nome completo, relacionamento com o cliente, número de telefone e e-mail. Essas informações serão mantidas estritamente confidenciais e utilizadas apenas em situações de emergência, não sendo divulgadas a terceiros exceto quando necessário para proteger a segurança e o bem-estar do paciente.",
    type: "agree",
  },
  {
    key: "consideracoes_finais",
    title: "Considerações Finais",
    description: "O paciente, neste ato, aceita todas as condições acima expostas, reiterando que o início do tratamento pelo paciente também pressupõe o aceite a todas as condições acima.\nPsicóloga Michelle Donegá dos Santos — CPF 310.461.838-00 — CRP 06/93008",
    type: "agree",
  },
];

const DEFAULT_LGPD = "Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), autorizo o(a) profissional a coletar, armazenar e tratar meus dados pessoais e de saúde exclusivamente para fins de acompanhamento psicológico. Os dados serão mantidos em sigilo, armazenados de forma segura, e não serão compartilhados com terceiros sem meu consentimento expresso, salvo em situações de risco previstas pelo Código de Ética do Psicólogo.";

export default function ContratoModelo() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const DRAFT_KEY = "rascunho_novo_contrato";

  const [professionalName, setProfessionalName] = useState("");
  const [professionalCrp, setProfessionalCrp] = useState("");
  const [professionalCpf, setProfessionalCpf] = useState("");
  const [professionalAddress, setProfessionalAddress] = useState("");
  const [professionalEmail, setProfessionalEmail] = useState("");
  const [lgpdClause, setLgpdClause] = useState(DEFAULT_LGPD);
  const [clauses, setClauses] = useState<Clause[]>(DEFAULT_CLAUSES);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftRestored(false);
  }, []);

  // Auto-save draft on every change (after initial load)
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        professionalName, professionalCrp, professionalCpf,
        professionalAddress, professionalEmail, lgpdClause, clauses,
      }));
    } catch {}
  }, [loaded, professionalName, professionalCrp, professionalCpf, professionalAddress, professionalEmail, lgpdClause, clauses]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: tpl }, { data: profile }] = await Promise.all([
        supabase
          .from("contract_templates")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, crp, phone, clinic_name")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      // Check for draft first (only when no template exists yet)
      let restoredFromDraft = false;
      if (!tpl) {
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft = JSON.parse(raw);
            if (draft.professionalName || draft.professionalCpf || draft.professionalAddress) {
              setProfessionalName(draft.professionalName ?? "");
              setProfessionalCrp(draft.professionalCrp ?? "");
              setProfessionalCpf(draft.professionalCpf ?? "");
              setProfessionalAddress(draft.professionalAddress ?? "");
              setProfessionalEmail(draft.professionalEmail ?? "");
              setLgpdClause(draft.lgpdClause ?? DEFAULT_LGPD);
              if (Array.isArray(draft.clauses) && draft.clauses.length > 0) setClauses(draft.clauses);
              restoredFromDraft = true;
              setDraftRestored(true);
            }
          }
        } catch {}
      }

      if (!restoredFromDraft) {
        if (tpl) {
          setTemplateId(tpl.id);
          setProfessionalName(tpl.professional_name || profile?.full_name || "");
          setProfessionalCrp((tpl as any).professional_crp || profile?.crp || "");
          setProfessionalCpf(tpl.professional_cpf || "");
          setProfessionalAddress(tpl.professional_address || "");
          setProfessionalEmail(tpl.professional_email || user.email || "");
          setLgpdClause(tpl.lgpd_clause);
          setClauses(tpl.clauses as unknown as Clause[]);
          // Clear any stale draft when DB template exists
          clearDraft();
        } else if (profile) {
          setProfessionalName(profile.full_name ?? "");
          setProfessionalCrp(profile.crp ?? "");
          setProfessionalEmail(user.email ?? "");
        }
      }
      setLoading(false);
      setLoaded(true);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      professional_name: professionalName,
      professional_crp: professionalCrp,
      professional_cpf: professionalCpf,
      professional_address: professionalAddress,
      professional_email: professionalEmail,
      lgpd_clause: lgpdClause,
      clauses: JSON.parse(JSON.stringify(clauses)),
    } as any;

    let error;
    if (templateId) {
      ({ error } = await supabase.from("contract_templates").update(payload).eq("id", templateId));
    } else {
      const res = await supabase.from("contract_templates").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setTemplateId(res.data.id);
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar modelo");
    } else {
      clearDraft();
      toast.success("Modelo salvo com sucesso!");
    }
  };
  const navigate = useNavigate();

  const publicLink = templateId
    ? `${window.location.origin}/contrato/${templateId}`
    : null;

  const copyLink = () => {
    if (publicLink) {
      navigator.clipboard.writeText(publicLink);
      toast.success("Link copiado!");
    }
  };

  const updateClause = (index: number, field: keyof Clause, value: string) => {
    setClauses((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeClause = (index: number) => {
    setClauses((prev) => prev.filter((_, i) => i !== index));
  };

  const addClause = () => {
    setClauses((prev) => [
      ...prev,
      { key: `custom_${Date.now()}`, title: "Nova Cláusula", description: "", type: "agree" },
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Termo de Adesão</h1>
          <p className="text-muted-foreground text-sm">
            Personalize seu contrato. O paciente receberá um link para preenchimento e aceite.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/app/contratos")}>
            <FileCheck className="h-4 w-4 mr-1" /> Contratos assinados
          </Button>
          <Button variant="accent" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar Modelo
          </Button>
        </div>
      </div>

      <PageIntro description="Modelo único de contrato terapêutico, personalizado com seus dados profissionais. O paciente recebe um link, lê e assina digitalmente — fica salvo em Contratos Assinados." />


      {draftRestored && (
        <div className="rounded-lg bg-accent/20 border border-accent/30 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between gap-2">
          <span>📝 Rascunho recuperado. Continue de onde parou.</span>
          <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={() => {
            clearDraft();
            setProfessionalName(""); setProfessionalCrp(""); setProfessionalCpf("");
            setProfessionalAddress(""); setProfessionalEmail(""); setLgpdClause(DEFAULT_LGPD);
            setClauses(DEFAULT_CLAUSES);
          }}>Descartar</Button>
        </div>
      )}

      {/* Link card - prominent */}
      {publicLink ? (
        <Card className="rounded-2xl border-accent/30 bg-accent/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-accent">
              <Link2 className="h-5 w-5" />
              <p className="font-display font-semibold">Link para o paciente preencher</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={publicLink}
                className="font-mono text-sm bg-card"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button variant="accent" size="sm" onClick={copyLink} className="shrink-0">
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <a href={publicLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie este link ao paciente por WhatsApp ou e-mail. Após preencher, o contrato aparecerá em "Contratos assinados".
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-dashed border-muted-foreground/30">
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            <Link2 className="h-6 w-6 mx-auto mb-2 opacity-40" />
            Salve o modelo para gerar o link de preenchimento para o paciente.
          </CardContent>
        </Card>
      )}

      {/* Professional info */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" /> Identificação do Profissional
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nome completo</Label>
            <Input value={professionalName} onChange={(e) => setProfessionalName(e.target.value)} placeholder="Nome do Psicólogo(a)" />
          </div>
          <div>
            <Label>CRP</Label>
            <Input value={professionalCrp} onChange={(e) => setProfessionalCrp(e.target.value)} placeholder="00/00000" />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={professionalCpf} onChange={(e) => setProfessionalCpf(e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço profissional</Label>
            <Input value={professionalAddress} onChange={(e) => setProfessionalAddress(e.target.value)} placeholder="Rua, número, cidade, estado" />
          </div>
          <div className="sm:col-span-2">
            <Label>E-mail para contato</Label>
            <Input type="email" value={professionalEmail} onChange={(e) => setProfessionalEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
        </CardContent>
      </Card>

      {/* Clauses */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg">Cláusulas do Contrato</CardTitle>
          <Button variant="outline" size="sm" onClick={addClause}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {clauses.map((clause, index) => (
            <div key={clause.key} className="border rounded-xl p-4 space-y-3 bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <Input
                      value={clause.title}
                      onChange={(e) => updateClause(index, "title", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select
                      value={clause.type}
                      onValueChange={(v) => {
                        setClauses((prev) =>
                          prev.map((c, i) =>
                            i === index
                              ? { ...c, type: v as "agree" | "radio" | "text", ...(v === "radio" && !c.options ? { options: ["Opção 1", "Opção 2"] } : {}) }
                              : c
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="agree">Aceite</SelectItem>
                        <SelectItem value="radio">Escolha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive mt-5" onClick={() => removeClause(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Descrição / Termos</Label>
                <Textarea
                  value={clause.description}
                  onChange={(e) => updateClause(index, "description", e.target.value)}
                  rows={2}
                />
              </div>
              {clause.type === "radio" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Opções (uma por linha)</Label>
                  <Textarea
                    value={(clause.options || []).join("\n")}
                    onChange={(e) => {
                      const opts = e.target.value.split("\n");
                      setClauses((prev) =>
                        prev.map((c, i) => (i === index ? { ...c, options: opts } : c))
                      );
                    }}
                    rows={2}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* LGPD */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg">Cláusula LGPD</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={lgpdClause}
            onChange={(e) => setLgpdClause(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}
