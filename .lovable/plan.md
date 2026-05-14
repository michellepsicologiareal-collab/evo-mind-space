## Objetivo

Permitir que a psicóloga envie um link público (mesmo modelo do termo) para o paciente/responsável preencher a Anamnese da Criança pelo WhatsApp. O preenchimento deve cair direto no painel do app, vinculado ao paciente correto.

## Fluxo do usuário

1. No card do paciente (página Pacientes) → menu "Anamnese (Criança)" ganha a opção **"Enviar link de preenchimento"**.
2. Ao clicar, abre o WhatsApp já com a mensagem: *"Olá [nome], segue o link para preencher sua anamnese: https://psireal.app/anamnese-crianca/{patientId}"*.
3. O paciente abre o link, vê uma página pública (sem login) com o mesmo formulário da anamnese — só os campos do "psi" e do paciente já vêm pré-preenchidos (nome da criança e nome da profissional).
4. Ao enviar, os dados caem em `child_anamneses` vinculados ao `user_id` da psicóloga.
5. A psicóloga vê a anamnese preenchida na tela **Anamneses** normalmente.

## Implementação técnica

### Backend
- Nova edge function `public-anamnesis` (verify_jwt=false) com duas ações:
  - `GET ?patient_id=...` → retorna `{ child_name, professional_name }` (lookup via service role na tabela `patients` + `profiles`).
  - `POST` → recebe `patient_id` + payload do formulário, valida tamanhos (zod), descobre `user_id` do paciente e insere em `child_anamneses` com service role.
- Validação: rejeita se LGPD não aceita ou campos obrigatórios vazios.
- Sem alteração de RLS (mantemos `child_anamneses` restrito por `user_id`; só a edge function escreve em nome do dono).

### Frontend
- Nova página pública `src/pages/AnamnesePublica.tsx` (rota `/anamnese-crianca/:patientId`) — visual igual ao `ContratoPublico.tsx` (header com logo, cards `border rounded-xl bg-card`, botão `variant="accent"`), reaproveitando as mesmas perguntas do `ChildAnamnesisForm.tsx`.
- Tela de sucesso ao enviar (mesmo padrão `CheckCircle2` do contrato).
- `src/App.tsx`: registrar a nova rota pública (fora do `ProtectedRoute`).
- `src/pages/app/Patients.tsx`: no dropdown do card adicionar item **"Enviar link de anamnese"** que copia o link e abre `wa.me/{telefone}?text=...` com a URL.

## Arquivos afetados
- `supabase/functions/public-anamnesis/index.ts` (novo)
- `supabase/config.toml` (declarar a função com `verify_jwt = false`)
- `src/pages/AnamnesePublica.tsx` (novo)
- `src/App.tsx` (rota)
- `src/pages/app/Patients.tsx` (botão WhatsApp no dropdown)

## O que NÃO muda
- Estrutura da tabela `child_anamneses` e RLS atual.
- Formulário interno (`ChildAnamnesisForm.tsx`) e tela `Anamneses.tsx` continuam iguais.
- Fluxo do termo/contrato.
