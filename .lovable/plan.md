# Endurecer SECURITY DEFINER functions

As 6 issues originais foram resolvidas. O scanner agora aponta 18 warnings (todas do linter Supabase) sobre `SECURITY DEFINER` functions executáveis por anon/authenticated. Algumas precisam ficar como estão (capability via token), outras dá pra revogar.

## Análise (rastreei cada função no código)

| Função | Quem chama | Ação |
|---|---|---|
| `has_role` | Apenas policies internas | **REVOKE** anon + auth |
| `is_supervisor_of` | Apenas policies internas | **REVOKE** anon + auth |
| `can_supervisor_see_patient` | Apenas policies internas | **REVOKE** anon + auth |
| `auto_assign_admin_role` | Trigger | **REVOKE** anon + auth |
| `protect_profile_access_fields` | Trigger | **REVOKE** anon (já sem auth) |
| `ensure_current_profile` | Client logado (`AuthContext`) | **REVOKE anon** (mantém auth) |
| `log_clinical_access` | Client logado | **REVOKE anon** (mantém auth) |
| `log_supervision_access` | Client logado | **REVOKE anon** (mantém auth) |
| `link_supervisee_by_email` | Supervisor logado | manter auth |
| `unlink_supervisee` | Supervisor logado | manter auth |
| `get_profile_id_by_email` | Supervisor logado | manter auth |
| `get_session_by_token` | **anon intencional** (paciente sem login confirma sessão por link com UUID-token) | manter, ignorar warning |
| `respond_to_confirmation` | **anon intencional** (idem) | manter, ignorar warning |

## Etapas

### 1. Migration com REVOKE/GRANT
- `REVOKE EXECUTE` de `anon, authenticated` nas 5 funções internas (`has_role`, `is_supervisor_of`, `can_supervisor_see_patient`, `auto_assign_admin_role`, `protect_profile_access_fields`).
- `REVOKE EXECUTE` de `anon` nas 3 funções de uso autenticado (`ensure_current_profile`, `log_clinical_access`, `log_supervision_access`).
- Manter intacto: `link_supervisee_by_email`, `unlink_supervisee`, `get_profile_id_by_email`, `get_session_by_token`, `respond_to_confirmation`.

### 2. Validação
- Rodar scan de novo — esperado: 18 → 2 warnings (as duas funções de confirmação pública).
- Smoke test mental: as 5 funções internas são chamadas em contexto de policy/trigger, onde o REVOKE não afeta (engine roda como dono); as 3 de log/profile continuam acessíveis ao client autenticado.

### 3. Ignorar warnings intencionais
- Marcar as 2 warnings restantes (`get_session_by_token` e `respond_to_confirmation`) como **ignored** no scanner, com explicação: "Função pública por design — autenticação é feita via UUID-token único enviado por e-mail/WhatsApp ao paciente para confirmar/cancelar sessão. Sem este acesso anon, a confirmação pública quebra."
- Atualizar a security memory com esse contexto.

## Resultado esperado

- Linter Supabase: 18 → 0 (após ignore dos 2 intencionais).
- Funcionalidade do app: 100% preservada (todos os RPCs do client continuam funcionando).
- Fluxo público de confirmação de sessão: preservado.
