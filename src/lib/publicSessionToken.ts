import { supabase } from "@/integrations/supabase/client";

export type SessionLookup =
  | { kind: "found"; row: any }
  | { kind: "not_found" }
  | { kind: "network" };

/**
 * Busca a sessão do link público de confirmação. Falhas de conexão (comuns no
 * 4G e no navegador do WhatsApp) são repetidas automaticamente e nunca são
 * tratadas como "link inválido" — só um token inexistente é inválido.
 */
export async function fetchSessionByToken(token: string, attempts = 4): Promise<SessionLookup> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await supabase.rpc("get_session_by_token", { _token: token });
      if (!error) {
        const rows = (data as any[]) || [];
        return rows.length ? { kind: "found", row: rows[0] } : { kind: "not_found" };
      }
      // Token malformado: é realmente inválido.
      if ((error as any).code === "22P02") return { kind: "not_found" };
    } catch {
      /* rede: tenta de novo */
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return { kind: "network" };
}

/**
 * Links públicos usam o token sem hífens: um UUID com hífens tem o mesmo
 * formato de uma chave PIX aleatória e o WhatsApp oferece "copiar chave Pix"
 * em vez de abrir o link. Links antigos (com hífens) continuam funcionando.
 */
export const compactToken = (token: string) => token.replace(/-/g, "").toLowerCase();

export const expandToken = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  if (/^[0-9a-f]{32}$/.test(t)) {
    return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
  }
  return t;
};
