import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cake, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";

type Row = { id: string; full_name: string; phone: string | null; birth_date: string | null };

type Item = {
  id: string;
  name: string;
  phone: string | null;
  day: number;
  month: number;
  age: number | null;
  /** dias até o aniversário dentro do mês de referência (0 = hoje) */
  diff: number;
};

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const BirthdaysCard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"dia" | "semana" | "mes">("mes");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone, birth_date")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .not("birth_date", "is", null);
      if (!cancelled) setRows((data ?? []) as Row[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const items = useMemo<Item[]>(() => {
    const today = startOfDay(new Date());
    return rows
      .filter((r) => !!r.birth_date)
      .map((r) => {
        const [y, m, d] = (r.birth_date as string).split("-").map(Number);
        const thisYear = new Date(today.getFullYear(), m - 1, d);
        const diff = Math.round((thisYear.getTime() - today.getTime()) / 86400000);
        const age = y ? today.getFullYear() - y : null;
        return { id: r.id, name: r.full_name, phone: r.phone, day: d, month: m, age, diff };
      })
      .sort((a, b) => (a.month - b.month) || (a.day - b.day));
  }, [rows]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const ofMonth = items.filter((i) => i.month === currentMonth);
  const ofWeek = items.filter((i) => i.diff >= 0 && i.diff <= 6);
  const ofDay = items.filter((i) => i.diff === 0);

  // Aviso do dia — uma vez por dia
  useEffect(() => {
    if (!ofDay.length) return;
    const key = `psireal:birthday-toast:${now.toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    toast.success(
      ofDay.length === 1
        ? `🎂 Hoje é aniversário de ${ofDay[0].name}`
        : `🎂 Hoje ${ofDay.length} pacientes fazem aniversário`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofDay.length]);

  const list = tab === "dia" ? ofDay : tab === "semana" ? ofWeek : ofMonth;

  const sendWhats = (i: Item) => {
    const digits = normalizePhoneForWhatsApp(i.phone ?? "");
    if (!digits) {
      toast.error("Paciente sem telefone cadastrado");
      return;
    }
    const msg = `Olá, ${i.name.split(" ")[0]}! Passando para desejar um feliz aniversário 🎉`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const TABS: { key: typeof tab; label: string; count: number }[] = [
    { key: "dia", label: "Hoje", count: ofDay.length },
    { key: "semana", label: "Semana", count: ofWeek.length },
    { key: "mes", label: "Mês", count: ofMonth.length },
  ];

  return (
    <Card className="rounded-2xl border-border/60 bg-card p-4 sm:p-5 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base sm:text-lg font-semibold text-foreground">
          <Cake className="h-4 w-4 text-primary" />
          Aniversariantes
          <span className="text-xs font-normal text-muted-foreground">de {MONTHS[currentMonth - 1]}</span>
        </h2>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                tab === t.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {tab === "dia"
            ? "Nenhum aniversário hoje."
            : tab === "semana"
              ? "Nenhum aniversário nos próximos 7 dias."
              : "Nenhum aniversário neste mês. Cadastre a data de nascimento na ficha do paciente."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {list.map((i) => (
            <li key={i.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {i.name}
                  {i.diff === 0 && (
                    <Badge className="ml-2 bg-primary text-primary-foreground align-middle">🎂 Hoje</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {String(i.day).padStart(2, "0")}/{String(i.month).padStart(2, "0")}
                  {i.age != null ? ` · faz ${i.age} anos` : ""}
                  {i.diff > 0 ? ` · em ${i.diff} dia${i.diff > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 rounded-full text-xs"
                onClick={() => sendWhats(i)}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Parabenizar</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
