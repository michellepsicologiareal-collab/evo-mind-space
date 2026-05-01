
-- Contract templates for each psychologist
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  professional_name text NOT NULL DEFAULT '',
  professional_cpf text NOT NULL DEFAULT '',
  professional_address text NOT NULL DEFAULT '',
  professional_email text NOT NULL DEFAULT '',
  clauses jsonb NOT NULL DEFAULT '[
    {"key":"local","title":"Local do Atendimento","description":"Terapia on-line ou presencial.","options":["Terapia on-line","Terapia presencial"],"type":"radio"},
    {"key":"honorarios","title":"Honorários","description":"Pagamento antecipado até o dia 5, reajuste anual e envio de comprovante.","type":"agree"},
    {"key":"duracao","title":"Duração","description":"Sessões de 50 minutos e política de atrasos.","type":"agree"},
    {"key":"contatos_sessoes","title":"Contatos entre as Sessões","description":"Dúvidas pontuais respondidas em até 24h.","type":"agree"},
    {"key":"urgencias","title":"Contatos de Urgências","description":"Procedimento para sinalização de urgência via mensagem ou ligação.","type":"agree"},
    {"key":"sigilo","title":"Sigilo","description":"Manutenção do sigilo, exceto em situações de risco. Conforme LGPD (Lei 13.709/2018), seus dados pessoais serão tratados exclusivamente para fins de tratamento clínico, armazenados com segurança e nunca compartilhados sem seu consentimento expresso.","type":"agree"},
    {"key":"duracao_tratamento","title":"Duração do Tratamento","description":"Tempo variável conforme a demanda.","type":"agree"},
    {"key":"dia_horario","title":"Dia e Horário","description":"Acordo mútuo sobre agenda.","type":"agree"},
    {"key":"desmarcacoes","title":"Desmarcações ou Mudanças de Horário","description":"Aviso prévio de 24h e limite de uma remarcação mensal.","type":"agree"},
    {"key":"faltas","title":"Faltas","description":"Cobrança de falta sem aviso e possível interrupção após duas faltas consecutivas.","type":"agree"},
    {"key":"rescisao","title":"Rescisão","description":"Direito de interrupção por ambas as partes mediante comunicação prévia.","type":"agree"}
  ]'::jsonb,
  lgpd_clause text NOT NULL DEFAULT 'Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), autorizo o(a) profissional a coletar, armazenar e tratar meus dados pessoais e de saúde exclusivamente para fins de acompanhamento psicológico. Os dados serão mantidos em sigilo, armazenados de forma segura, e não serão compartilhados com terceiros sem meu consentimento expresso, salvo em situações de risco previstas pelo Código de Ética do Psicólogo.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own template" ON public.contract_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own template" ON public.contract_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own template" ON public.contract_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own template" ON public.contract_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signed contracts (patient acceptances)
CREATE TABLE public.signed_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- the psychologist who owns this
  patient_name text NOT NULL,
  patient_whatsapp text NOT NULL DEFAULT '',
  patient_birth_date date,
  patient_cpf text NOT NULL DEFAULT '',
  patient_address text NOT NULL DEFAULT '',
  emergency_contact_name text NOT NULL DEFAULT '',
  emergency_contact_relationship text NOT NULL DEFAULT '',
  emergency_contact_phone text NOT NULL DEFAULT '',
  clause_responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_lgpd boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signed_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signed contracts" ON public.signed_contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own signed contracts" ON public.signed_contracts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert signed contracts" ON public.signed_contracts FOR INSERT WITH CHECK (true);
-- Public select for template info needed on the public acceptance page
CREATE POLICY "Anyone can read templates for public links" ON public.contract_templates FOR SELECT USING (true);
