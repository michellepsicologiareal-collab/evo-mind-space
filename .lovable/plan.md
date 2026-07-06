## O que será entregue

Uma nova anamnese inicial para **pacientes adultos**, seguindo o mesmo padrão da anamnese infantil já existente: a psicóloga gera um link com token, o paciente preenche sem login e as respostas caem automaticamente na ficha clínica.

## Estrutura

### 1. Banco de dados (nova migration)
- Tabela `adult_anamneses` com todos os 12 blocos do escopo:
  - Dados pessoais (nome, nascimento, telefone, e-mail, profissão, estado civil, contato de emergência)
  - Motivo da procura, tempo do problema, impacto (0-10)
  - Sintomas (jsonb com marcados + campo "outro")
  - Tratamentos anteriores (medicação, psicoterapia, psiquiatra)
  - Escalas de vida (sono, alimentação, trabalho, relacionamentos, lazer, saúde — 0-10 cada)
  - Rede de apoio, eventos importantes, objetivos, informações adicionais
  - **Segurança**: `risk_ideation` (`none` / `sometimes` / `frequent`) + flag `risk_flag` calculado
  - `status` ('recebida' por padrão), `submitted_at`, `authorized_lgpd`
- Novo tipo de convite: reuso da tabela `anamnesis_invites` com coluna `anamnesis_type` (`child` | `adult`), ou tabela irmã `adult_anamnesis_invites` (vou usar a segunda para não impactar o fluxo infantil).
- RPCs `SECURITY DEFINER`:
  - `get_adult_anamnesis_by_invite_token(_token)` → devolve nome do profissional e status.
  - `submit_adult_anamnesis(_token, _payload, _ip, _ua)` → trava atômica, cria/atualiza `patients` se necessário (busca por telefone/email do mesmo user_id; senão insere novo com o nome informado), grava anamnese, vincula ao invite, notifica psicóloga (com prefixo ⚠️ quando há risco).
- RLS: psicóloga (owner) lê/edita/exclui as próprias anamneses; nada exposto ao paciente autenticado. GRANTs para `authenticated` e `service_role`.

### 2. Edge function `public-adult-anamnesis`
- Espelha `public-anamnesis`: throttle por IP/token, valida UUID, chama as RPCs com service role, trata erros (`invite_revoked`, `invite_expired`, `invite_already_used`, `lgpd_required`, `missing_required_fields`).

### 3. Página pública `/anamnese-adulto/:token`
- Nova rota em `App.tsx`, lazy-loaded.
- Layout responsivo, mobile-first, identidade PsiReal (logo, gradient hero, cards `rounded-2xl`, `font-display`).
- **Barra de progresso fixa no topo** calculada a partir dos campos preenchidos.
- **12 seções em cards**, cada uma com título e ícone leve.
- **Autosave em `localStorage`** com chave por token (rascunho + indicador "Salvo automaticamente").
- Botão "Continuar" faz scroll para próxima seção; "Enviar Anamnese" só habilita após consentimento LGPD.
- Sintomas via `Checkbox` grid 2 colunas + campo "Outro" condicional.
- Impacto e escalas de vida usando `Slider` (0-10) com label numérico grande.
- Medicação/psicoterapia/psiquiatra via `RadioGroup`; medicamento aparece condicional.
- **Seção 12 (Segurança)** obrigatória. Ao escolher "Algumas vezes" ou "Frequentemente", mostra alerta acolhedor abaixo do campo (não bloqueia envio).
- Tela pós-envio com mensagem de agradecimento e ícone.

### 4. Integração na ficha do profissional
- Página `/app/anamneses` ganha **tabs**: "Crianças" | "Adultos".
- Nova aba lista adult_anamneses com nome, data de envio, badge de status ("Recebida") e **badge vermelha "⚠️ Atenção"** quando `risk_flag`.
- Modal de leitura em formato organizado (mesmo componente com blocos), somente-leitura por padrão + botão "Editar" que libera edição pelo psicólogo.
- Botão **"Exportar PDF"** usando `jsPDF` (já instalado) com nome do paciente, profissional, seções.
- Botão **"Gerar link de anamnese adulto"** na ficha do paciente (Patients.tsx) — cria invite e copia URL, espelhando o fluxo do infantil.

### 5. Mapa de preenchimento
- Incluir a anamnese adulto no "Mapa de preenchimento" dos cards em Patients.tsx quando o paciente é adulto (mostra pill "Anamnese adulto" preenchido/pendente).

## Detalhes técnicos

- Sem alteração do fluxo infantil existente.
- Design system: apenas tokens semânticos (`bg-card`, `text-foreground`, `variant="accent"`).
- Sem novas dependências; usa `jspdf` já presente no projeto.
- Types do Supabase regeneram automaticamente após a migration.

## Ordem de execução

1. Migration (tabela + invites + RPCs + RLS + GRANTs).
2. Edge function `public-adult-anamnesis`.
3. Página pública + rota.
4. UI da ficha profissional (tabs em Anamneses, botão de convite em Patients, exportação PDF).
5. Verificação: `tsgo`, revisar console/network no formulário, testar submit fake.
