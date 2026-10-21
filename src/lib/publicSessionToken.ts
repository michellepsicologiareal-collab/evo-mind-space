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
