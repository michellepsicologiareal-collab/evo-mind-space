import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, FileText, Copy, ExternalLink, Plus, Trash2, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Clause {
  key: string;
  title: string;
  description: string;
  type: "agree" | "radio";
  options?: string[];
}

const DEFAULT_CLAUSES: Clause[] = [
  { key: "local", title: "Local do Atendimento", description: "Terapia on-line ou presencial.", type: "radio", options: ["Terapia on-line", "Terapia presencial"] },
  { key: "honorarios", title: "Honorários", description: "Pagamento antecipado até o dia 5, reajuste anual e envio de comprovante.", type: "agree" },
  { key: "duracao", title: "Duração", description: "Sessões de 50 minutos e política de atrasos.", type: "agree" },
  { key: "contatos_sessoes", title: "Contatos entre as Sessões", description: "Dúvidas pontuais respondidas em até 24h.", type: "agree" },
  { key: "urgencias", title: "Contatos de Urgências", description: "Procedimento para sinalização de urgência via mensagem ou ligação.", type: "agree" },
  { key: "sigilo", title: "Sigilo", description: "Manutenção do sigilo, exceto em situações de risco. Conforme LGPD (Lei 13.709/2018), seus dados pessoais serão tratados exclusivamente para fins de tratamento clínico.", type: "agree" },
  { key: "duracao_tratamento", title: "Duração do Tratamento", description: "Tempo variável conforme a demanda.", type: "agree" },
  { key: "dia_horario", title: "Dia e Horário", description: "Acordo mútuo sobre agenda.", type: "agree" },
  { key: "desmarcacoes", title: "Desmarcações ou Mudanças de Horário", description: "Aviso prévio de 24h e limite de uma remarcação mensal.", type: "agree" },
  { key: "faltas", title: "Faltas", description: "Cobrança de falta sem aviso e possível interrupção após duas faltas consecutivas.", type: "agree" },
  { key: "rescisao", title: "Rescisão", description: "Direito de interrupção por ambas as partes mediante comunicação prévia.", type: "agree" },
];

const DEFAULT_LGPD = "Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), autorizo o(a) profissional a coletar, armazenar e tratar meus dados pessoais e de saúde exclusivamente para fins de acompanhamento psicológico. Os dados serão mantidos em sigilo, armazenados de forma segura, e não serão compartilhados com terceiros sem meu consentimento expresso, salvo em situações de risco previstas pelo Código de Ética do Psicólogo.";

export default function ContratoModelo() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const [professionalName, setProfessionalName] = useState("");
  const [professionalCpf, setProfessionalCpf] = useState("");
  const [professionalAddress, setProfessionalAddress] = useState("");
  const [professionalEmail, setProfessionalEmail] = useState("");
  const [lgpdClause, setLgpdClause] = useState(DEFAULT_LGPD);
  const [clauses, setClauses] = useState<Clause[]>(DEFAULT_CLAUSES);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setTemplateId(data.id);
        setProfessionalName(data.professional_name);
        setProfessionalCpf(data.professional_cpf);
        setProfessionalAddress(data.professional_address);
        setProfessionalEmail(data.professional_email);
        setLgpdClause(data.lgpd_clause);
        setClauses(data.clauses as unknown as Clause[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      professional_name: professionalName,
      professional_cpf: professionalCpf,
      professional_address: professionalAddress,
      professional_email: professionalEmail,
      lgpd_clause: lgpdClause,
      clauses: JSON.parse(JSON.stringify(clauses)),
    };

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
      toast.success("Modelo salvo com sucesso!");
    }
  };

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
          {publicLink && (
            <>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-1" /> Copiar Link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={publicLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Visualizar
                </a>
              </Button>
            </>
          )}
          <Button variant="accent" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar Modelo
          </Button>
        </div>
      </div>

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
                              ? { ...c, type: v as "agree" | "radio", ...(v === "radio" && !c.options ? { options: ["Opção 1", "Opção 2"] } : {}) }
                              : c
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
