import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingDown, Sparkles, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aggregateDistortions, fromRpdRecord } from "@/lib/rpd";
import type { RpdReadRecord } from "./RpdRecordsRead";

interface Props {
  records: (RpdReadRecord & { intensidade_emocao_inicial?: any; intensidade_emocao_final?: any })[];
  accent: string;
  ink?: string;
  muted?: string;
}

const avg = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);

/**
 * Painel de evolução do paciente: consolida os registros de TCC em gráficos
 * simples (crença antes/depois, intensidade das emoções e armadilhas mais
 * frequentes). Somente leitura, mobile-first.
 */
export function RpdEvolutionPanel({ records, accent, ink = "#1A1A2E", muted = "#6B7280" }: Props) {
  const ordered = useMemo(
    () => [...records].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [records],
  );

  const series = useMemo(
    () =>
      ordered.map((r, i) => {
        const parsed = fromRpdRecord(r);
        const before = parsed.emotions.map((e) => e.before).filter((n): n is number => typeof n === "number");
        const after = parsed.emotions.map((e) => e.after).filter((n): n is number => typeof n === "number");
        return {
          idx: i + 1,
          label: format(new Date(r.created_at), "dd/MM", { locale: ptBR }),
          crencaAntes: r.crenca_pensamento_inicial ?? null,
          crencaDepois: r.crenca_pensamento_final ?? null,
          emocaoAntes: avg(before),
          emocaoDepois: avg(after),
        };
      }),
    [ordered],
  );

  const distortions = useMemo(() => aggregateDistortions(ordered).slice(0, 6), [ordered]);

  const stats = useMemo(() => {
    const beliefPairs = series.filter((s) => s.crencaAntes != null && s.crencaDepois != null);
    const emoPairs = series.filter((s) => s.emocaoAntes != null && s.emocaoDepois != null);
    const drop = (arr: typeof series, a: "crencaAntes" | "emocaoAntes", b: "crencaDepois" | "emocaoDepois") =>
      arr.length ? Math.round(arr.reduce((acc, s) => acc + ((s[a] as number) - (s[b] as number)), 0) / arr.length) : null;
    return {
      total: ordered.length,
      beliefDrop: drop(beliefPairs, "crencaAntes", "crencaDepois"),
      emotionDrop: drop(emoPairs, "emocaoAntes", "emocaoDepois"),
      topDistortion: distortions[0]?.simple ?? null,
    };
  }, [series, ordered, distortions]);

  if (ordered.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed p-5 text-center" style={{ borderColor: `${accent}55` }}>
        <BarChart3 className="h-6 w-6 mx-auto mb-2" style={{ color: accent, opacity: 0.6 }} />
        <p style={{ fontSize: 13, color: muted }}>
          Assim que você enviar seus primeiros registros, os gráficos da sua evolução aparecem aqui.
        </p>
      </div>
    );
  }

  const axis = { fontSize: 9, fill: muted } as const;

  const Card = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
    <section className="bg-white rounded-[10px] p-3 sm:p-5" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: ink }}>{title}</h3>
      <p className="mb-2" style={{ fontSize: 12, color: muted }}>{hint}</p>
      {children}
    </section>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[
          { label: "Registros enviados", value: String(stats.total), Icon: Sparkles },
          {
            label: "Queda média na crença",
            value: stats.beliefDrop != null ? `${stats.beliefDrop} pts` : "—",
            Icon: TrendingDown,
          },
          {
            label: "Queda média na emoção",
            value: stats.emotionDrop != null ? `${stats.emotionDrop} pts` : "—",
            Icon: TrendingDown,
          },
          { label: "Armadilha mais comum", value: stats.topDistortion ?? "—", Icon: BarChart3 },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="bg-white rounded-[10px] p-3 min-w-0" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-start gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 mt-px" style={{ color: accent }} />
              <span className="text-[10px] font-bold uppercase tracking-wide leading-tight" style={{ color: muted }}>{label}</span>
            </div>
            <p className="mt-1 font-display break-words" style={{ fontSize: 16, fontWeight: 700, color: ink }}>{value}</p>
          </div>
        ))}
      </div>

      <Card
        title="Quanto você acreditou no pensamento"
        hint="Comparação entre antes e depois de questionar o pensamento, em cada registro."
      >
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={30} tickCount={5} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                formatter={(v: any, n: any) => [`${v}%`, n === "crencaAntes" ? "Antes" : "Depois"]}
              />
              <Line type="monotone" dataKey="crencaAntes" stroke={accent} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="crencaDepois" stroke="#3D5C35" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend accent={accent} muted={muted} />
      </Card>

      <Card
        title="Intensidade das emoções"
        hint="Média da intensidade que você marcou nas emoções de cada registro (0 a 100)."
      >
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={30} tickCount={5} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                formatter={(v: any, n: any) => [`${v}`, n === "emocaoAntes" ? "Antes" : "Depois"]}
              />
              <Line type="monotone" dataKey="emocaoAntes" stroke={accent} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="emocaoDepois" stroke="#3D5C35" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend accent={accent} muted={muted} />
      </Card>

      <Card
        title="Armadilhas do pensamento mais frequentes"
        hint="Quantas vezes cada armadilha apareceu nos seus registros."
      >
        {distortions.length === 0 ? (
          <p style={{ fontSize: 13, color: muted }}>Você ainda não marcou armadilhas nos seus registros.</p>
        ) : (
          <div style={{ height: Math.max(140, distortions.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distortions} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="simple"
                  tick={{ fontSize: 10, fill: ink }}
                  tickLine={false}
                  axisLine={false}
                  width={96}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                  formatter={(v: any) => [`${v} registro${Number(v) > 1 ? "s" : ""}`, "Frequência"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                  {distortions.map((d, i) => (
                    <Cell key={d.simple} fill={i === 0 ? accent : `${accent}80`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <p className="px-1" style={{ fontSize: 11, color: muted }}>
        Estes gráficos são um apoio para você perceber padrões — quem interpreta clinicamente é a sua psicóloga.
      </p>
    </div>
  );
}

function Legend({ accent, muted }: { accent: string; muted: string }) {
  return (
    <div className="flex items-center gap-4 mt-2">
      {[
        { label: "Antes", color: accent },
        { label: "Depois", color: "#3D5C35" },
      ].map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: muted }}>
          <span className="h-2 w-2 rounded-full" style={{ background: l.color }} /> {l.label}
        </span>
      ))}
    </div>
  );
}
