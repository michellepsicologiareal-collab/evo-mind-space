import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { parseDistortionChips } from "@/lib/rpd";

export interface RpdReadRecord {
  id: string;
  created_at: string;
  situation: string | null;
  automatic_thought: string | null;
  emotion: string | null;
  behavior: string | null;
  cognitive_distortion: string | null;
  rational_response: string | null;
  crenca_pensamento_inicial: number | null;
  crenca_pensamento_final: number | null;
}

const FIELDS: { key: keyof RpdReadRecord; label: string }[] = [
  { key: "situation", label: "O que aconteceu" },
  { key: "automatic_thought", label: "O que passou pela sua cabeça" },
  { key: "emotion", label: "Como você se sentiu" },
  { key: "behavior", label: "O que você fez" },
  { key: "rational_response", label: "Outro jeito de olhar" },
];

/**
 * Lista somente-leitura dos registros de pensamentos (RPD), pensada para o
 * paciente: mobile-first, sem tabelas, cada registro em um card expansível.
 */
export function RpdRecordsRead({
  records,
  accent,
  ink = "#1A1A2E",
  muted = "#6B7280",
}: {
  records: RpdReadRecord[];
  accent: string;
  ink?: string;
  muted?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(records[0]?.id ?? null);

  if (records.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed p-5 text-center" style={{ borderColor: `${accent}55` }}>
        <ClipboardList className="h-6 w-6 mx-auto mb-2" style={{ color: accent, opacity: 0.6 }} />
        <p style={{ fontSize: 13, color: muted }}>
          Você ainda não enviou nenhum registro. Preencha o formulário acima e ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {records.map((r) => {
        const isOpen = openId === r.id;
        const preview = r.situation || r.automatic_thought || "Registro";
        const chips = parseDistortionChips(r.cognitive_distortion);
        return (
          <li key={r.id} className="rounded-[10px] border bg-white overflow-hidden" style={{ borderColor: `${accent}33` }}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : r.id)}
              aria-expanded={isOpen}
              className="w-full flex items-start gap-2 p-3 sm:p-4 text-left min-h-12"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold" style={{ color: accent }}>
                  {format(new Date(r.created_at), "dd 'de' MMM 'de' yyyy · HH:mm", { locale: ptBR })}
                </p>
                <p className="mt-0.5 text-sm leading-snug break-words line-clamp-2" style={{ color: ink }}>
                  {preview}
                </p>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 mt-1" style={{ color: muted }} />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 mt-1" style={{ color: muted }} />
              )}
            </button>

            {isOpen && (
              <div className="px-3 sm:px-4 pb-4 pt-3 space-y-3 border-t" style={{ borderColor: `${accent}22` }}>
                {FIELDS.map(({ key, label }) => {
                  const val = r[key] as string | null;
                  if (!val) return null;
                  return (
                    <div key={String(key)} className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</p>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed" style={{ color: ink }}>{val}</p>
                    </div>
                  );
                })}

                {chips.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Armadilhas do pensamento</p>
                    <ul className="flex flex-wrap gap-1.5 mt-1">
                      {chips.map((c, i) => (
                        <li
                          key={`${c.simple}-${i}`}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 max-w-full"
                          style={{ background: `${accent}14`, border: `1px solid ${accent}33`, fontSize: 11, color: ink }}
                        >
                          <span className="font-semibold break-words">{c.simple}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(r.crenca_pensamento_inicial != null || r.crenca_pensamento_final != null) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Quanto você acreditou no pensamento</p>
                    <p className="text-sm" style={{ color: ink }}>
                      {r.crenca_pensamento_inicial != null ? `Antes: ${r.crenca_pensamento_inicial}%` : "Antes: —"}
                      {" · "}
                      {r.crenca_pensamento_final != null ? `Depois: ${r.crenca_pensamento_final}%` : "Depois: —"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
