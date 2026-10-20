import { useMemo, useState } from "react";
import { ChevronRight, Search, Users, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/app/Skeletons";
import { summarizePatientFinance, type PatientFinanceSession } from "@/lib/patientFinance";

interface Props {
  patients: { id: string; name: string }[];
  sessions: PatientFinanceSession[];
  month: Date;
  loading: boolean;
  onOpen: (patient: { id: string; name: string }) => void;
}
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function PatientFinanceOverview({ patients, sessions, month, loading, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const entries = useMemo(() => {
    const grouped = new Map<string, PatientFinanceSession[]>();
    sessions.forEach((s) => { if (s.patient) grouped.set(s.patient.id, [...(grouped.get(s.patient.id) ?? []), s]); });
    const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return patients.filter((p) => normalize(p.name).includes(normalize(query.trim()))).map((p) => ({ ...p, sessions: grouped.get(p.id) ?? [], summary: summarizePatientFinance(grouped.get(p.id) ?? []) }));
  }, [patients, sessions, query]);
  return <section aria-label="Painel financeiro por paciente" className="space-y-4 border-y border-border py-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="flex items-center gap-2 font-sans text-xl font-semibold"><Users className="h-5 w-5 text-primary" /> Painel por paciente</h2><p className="mt-1 text-sm text-muted-foreground">{format(month, "MMMM 'de' yyyy", { locale: ptBR })} · {patients.length} pacientes</p></div>
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar no painel por paciente" placeholder="Buscar por nome" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(8); }} className="pl-9" /></div>
    </div>
    {loading ? <ListSkeleton count={3} /> : <>
      <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_44px] gap-4 px-4 text-xs font-medium text-muted-foreground md:grid"><span>Paciente</span><span>Pago</span><span>Em aberto</span><span>Pago + em aberto</span><span /></div>
      <div className="space-y-2">{entries.slice(0, limit).map((p) => <Button key={p.id} variant="ghost" onClick={() => onOpen({ id: p.id, name: p.name })} aria-label={`Abrir painel de ${p.name}`} className="h-auto w-full justify-start whitespace-normal rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/60">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_24px] items-center gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_44px] md:gap-4">
          <div className="min-w-0"><p className="break-words text-sm font-semibold text-foreground">{p.name}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{p.sessions.length ? `${p.sessions.length} sessões · ${p.summary.completed} realizadas` : "Sem sessões no mês"}</p></div>
          <ChevronRight className="h-4 w-4 text-primary md:col-start-5 md:row-start-1" />
          <div className="col-span-2 grid grid-cols-3 gap-2 md:contents">{[{ label: "Pago", value: p.summary.paid, tone: "text-moss" }, { label: "Em aberto", value: p.summary.pending, tone: "text-destructive" }, { label: "Pago + em aberto", value: p.summary.total, tone: "text-foreground" }].map((v) => <div key={v.label} className="min-w-0"><p className="mb-1 text-[11px] font-normal text-muted-foreground md:hidden">{v.label}</p><p className={`break-words text-sm font-semibold tabular-nums ${v.tone}`}>{money(v.value)}</p></div>)}</div>
        </div>
      </Button>)}</div>
      {entries.length === 0 && <div className="py-8 text-center"><Wallet className="mx-auto mb-2 h-6 w-6 text-primary" /><p className="text-sm text-muted-foreground">Nenhum paciente encontrado nesta busca.</p></div>}
      {entries.length > limit && <div className="flex justify-center"><Button variant="outline" size="sm" onClick={() => setLimit((n) => n + 12)}>Ver mais pacientes ({entries.length - limit})</Button></div>}
    </>}
  </section>;
}