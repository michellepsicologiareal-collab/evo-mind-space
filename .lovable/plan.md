
## Objetivo
Fechar o P1 do `public-anamnesis` eliminando o acesso por `patient_id` público. Espelhar o padrão já validado em `public-contract` (token aleatório, uso único, expiração e revogação) com o menor volume possível de código para economizar créditos.

## Escopo (só isto neste turno)
1. Nova tabela `public.anamnesis_invites` (mesmo formato do `contract_invites`):
   - `id, user_id, patient_id, token uuid unique, expires_at, used_at, revoked_at, signed_anamnesis_id, created_at, updated_at`
   - RLS: apenas o profissional dono lê/insere/atualiza; `anon` sem grants.
   - Trigger `protect_anamnesis_invite_fields` (mesmo modelo do contrato): roles `authenticated`/`anon` não conseguem alterar `used_at`, `signed_anamnesis_id`, `token`, `template_id equivalente = patient_id`, `user_id`. Owner ainda pode revogar/estender.
2. Coluna `child_anamneses.invite_id uuid` (nullable, FK) para rastreabilidade — não quebra os 2 registros históricos.
3. Duas funções SECURITY DEFINER:
   - `get_child_anamnesis_by_invite_token(_token uuid)` → retorna só nome da criança + nome/CRP do profissional + status (`active|used|expired|revoked`). Nada mais do paciente é revelado.
   - `submit_child_anamnesis(_token uuid, _payload jsonb, _ip text, _ua text)` → trava atômica em `UPDATE ... SET used_at=now() WHERE token=? AND ativo`, insere em `child_anamneses` com `invite_id`, notifica profissional. Erros claros para revogado/expirado/já usado/lgpd ausente.
4. Rewrite curto da edge function `public-anamnesis`:
   - Remove suporte a `patient_id`. Passa a aceitar apenas `?token=` (GET) e `{token,...}` (POST).
   - IP via header (`x-forwarded-for` sanitizado pela borda) e UA via header — ignora quaisquer valores enviados no body. Body só como metadado.
   - Throttle simples em memória (Map por token e por IP, N tentativas/min) — best-effort, zero custo.
   - Zod-lite (checagens manuais atuais já cobrem; mantenho para não inflar bundle).
5. Frontend:
   - Rota vira `/anamnese-crianca/:token` em `src/App.tsx`.
   - `AnamnesePublica.tsx`: troca `patientId` por `token` na URL e no body.
   - `Patients.tsx` (botão "Enviar anamnese"): antes de gerar o link, chama `supabase.from('anamnesis_invites').insert({patient_id, expires_at})` (RLS garante `user_id=auth.uid()` via default) e usa o `token` retornado no link WhatsApp. Adiciono coluna default `user_id = auth.uid()` na tabela para simplificar.
   - Sem UI de gestão de convites nesta iteração (P2). Só o link individual.
6. Registros históricos:
   - Verificado: 2 `child_anamneses` já preenchidos, ambos permanecem intactos (a coluna `invite_id` é nullable).
   - URLs antigas `/anamnese-crianca/<patient_uuid>` ficam inertes: a rota agora exige token, e a edge function não aceita mais `patient_id`. Sem migração destrutiva.
7. Testes E2E via Edge Function (mesmos casos do contrato):
   - GET sem token / não-UUID / desconhecido / expirado / revogado / válido.
   - POST reuso / expirado / revogado / LGPD ausente / body tentando forjar `ip`/`user_agent`.
   - Confirmar via SQL que RLS bloqueia `anon` de ler `anamnesis_invites` e `child_anamneses`.
8. Limpeza dos dados E2E do contrato:
   - Migration com `DELETE FROM contract_invites WHERE id::text LIKE 'e2e%'` e o `signed_contracts` correspondente ao token e2e22222 (o único que foi assinado no teste). Os 2 contratos históricos legítimos ficam intactos (não têm `invite_id` casando com esses).

## Fora de escopo (P2/P3, não tocar agora)
- CORS lockdown, ajustes de lint, unificação helper `resolveClientIp`, UI de gestão de convites de anamnese, .env.

## Fluxo técnico resumido (para revisão)
```text
Profissional clica "Enviar anamnese"
  → INSERT anamnesis_invites (patient_id, expires_at=+30d)  [RLS auth.uid()]
  → link WhatsApp: /anamnese-crianca/<token>

Responsável abre link
  → GET public-anamnesis?token=... → get_child_anamnesis_by_invite_token
    → 200 (child_name + profissional) | 400 | 404 | 410
  → POST public-anamnesis {token, campos, authorized_lgpd:true}
    → submit_child_anamnesis (atomic used_at) 
    → 200 {ok:true} | 400 | 404 | 410
```

## Entregáveis ao final
- Migração(ões) executada(s), arquivos alterados, resultados dos testes E2E (tabela mesmo formato do contrato), consumo aproximado de créditos, confirmação de que os 2 anamneses históricos e os 2 contratos históricos seguem íntegros e que os dados E2E do contrato foram removidos.
