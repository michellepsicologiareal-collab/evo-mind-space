import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, X, Lock, ClipboardList, CheckCircle2, History, PenLine, TrendingUp, Smile, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RpdForm } from "@/components/app/RpdForm";
import { RpdRecordsRead, type RpdReadRecord } from "@/components/app/RpdRecordsRead";
import { RpdEvolutionPanel } from "@/components/app/RpdEvolutionPanel";
import { PatientMoodSelfReport } from "@/components/app/PatientMoodSelfReport";
import { emptyRpdForm, toRpdPayload, hasRpdContent, type RpdFormState } from "@/lib/rpd";
import { toast } from "sonner";
import logoImg from "@/assets/logo-psireal.png";

const G = "#B8860B";
const INK = "#1A1A2E";
const MUTED = "#6B7280";

const RpdPublico = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "password" | "ready" | "error" | "done">("loading");
  const [info, setInfo] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RpdFormState>(emptyRpdForm());
  const [tab, setTab] = useState<"home" | "mood" | "form" | "list" | "evo">("home");
  const [records, setRecords] = useState<RpdReadRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const loadRecords = async (pwd: string) => {
    if (!token) return;
    setLoadingRecords(true);
    const { data, error } = await supabase.rpc("list_rpd_by_token", { _token: token, _password: pwd });
    setLoadingRecords(false);
    if (!error) setRecords((data as RpdReadRecord[]) ?? []);
  };

  useEffect(() => {
    document.title = "RPD — Registro de Pensamentos | Psi Real";
    return () => { document.title = "Psi Real — Gestão Inteligente para Psicólogos"; };
  }, []);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    (async () => {
      const { data, error } = await supabase.rpc("get_rpd_invite_info", { _token: token });
      const meta = (data as any[])?.[0];
      if (error || !meta || !meta.valid) { setState("error"); return; }
      setInfo(meta);
      if (meta.password_required) {
        setState("password");
      } else {
        setState("ready");
        void loadRecords("");
      }
    })();
  }, [token]);

  const submit = async () => {
    if (!hasRpdContent(form)) {
      toast.error("Preencha ao menos uma etapa.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("submit_rpd_by_token", {
      _token: token as string,
      _password: password,
      _payload: toRpdPayload(form) as any,
    });
    setSaving(false);
    if (error) {
      if (error.message?.includes("invalid_password")) { setPwdError("Senha incorreta."); setState("password"); return; }
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    void loadRecords(password);
    setState("done");
  };

  if (state === "loading") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl bg-card border border-border p-8">
          <X className="h-12 w-12 mx-auto text-destructive/40 mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground">Link inválido ou expirado</h2>
          <p className="mt-2 text-muted-foreground">Peça um novo link à sua psicóloga.</p>
        </div>
      </div>
    );
  }

  if (state === "password") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); if (password.trim()) { setPwdError(null); setState("ready"); void loadRecords(password); } }}
          className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 space-y-4"
        >
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-lilac/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-lilac" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mt-3">Link protegido</h2>
            <p className="mt-1 text-sm text-muted-foreground">Digite a senha enviada pela sua psicóloga.</p>
          </div>
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" maxLength={60} className="min-h-12 text-base" />
          {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
          <Button type="submit" variant="accent" className="w-full min-h-12 text-base" disabled={!password.trim()}>Acessar</Button>

        </form>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl bg-card border border-border p-8">
          <CheckCircle2 className="h-12 w-12 mx-auto text-moss mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground">Registro enviado!</h2>
          <p className="mt-2 text-muted-foreground">Sua psicóloga já pode ver este registro. Obrigado por preencher.</p>
          <Button
            variant="outline"
            className="mt-5 w-full sm:w-auto min-h-12"
            onClick={() => { setForm(emptyRpdForm()); setTab("home"); setState("ready"); window.scrollTo({ top: 0 }); }}

          >
            Voltar ao início
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full sm:w-auto min-h-12"
            onClick={() => { setForm(emptyRpdForm()); setTab("list"); setState("ready"); window.scrollTo({ top: 0 }); }}
          >
            Ver meus registros
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>
      {/* Header fixo (mobile-first) */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{ background: "rgba(247,246,243,0.92)", borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2">
          <img src={logoImg} alt="Psi Real" className="h-7 w-7 object-contain shrink-0" />
          <span className="font-display text-base font-bold text-foreground">Psi Real</span>
          <span className="ml-auto text-[11px] font-semibold" style={{ color: MUTED }}>
            Registro de Pensamentos
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 space-y-3 sm:space-y-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
        <div className="bg-white rounded-[10px] p-4 sm:p-6 space-y-1" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>
            TCC · Registro de Pensamentos
          </p>
          <h1 className="font-display flex items-center gap-2 text-[18px] sm:text-[20px]" style={{ fontWeight: 700, color: INK }}>
            <ClipboardList className="h-5 w-5 shrink-0" style={{ color: G }} /> Novo registro
          </h1>
          <p className="break-words" style={{ fontSize: 13, color: MUTED }}>
            {info?.patient_name} · Psicóloga: {info?.therapist_name}{info?.therapist_crp ? ` · CRP ${info.therapist_crp}` : ""}
          </p>
          <p style={{ fontSize: 13, color: MUTED }}>
            Este é o seu espaço para acompanhar o que você sente e pensa durante a semana.
          </p>
        </div>

        {tab === "home" && (
          <div className="bg-white rounded-[10px] p-4 sm:p-6 space-y-2" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
            <p className="font-display text-[15px] font-bold" style={{ color: INK }}>O que é o RPD?</p>
            <p style={{ fontSize: 13, color: MUTED }}>
              RPD significa Registro de Pensamentos. É uma ferramenta da terapia que ajuda a perceber como as situações do dia a dia, os pensamentos e as emoções se conectam: o que aconteceu, o que passou pela sua cabeça na hora e o que você sentiu. Não precisa preencher perfeitamente — registre o que você percebeu naquele momento.
            </p>
            <p className="font-display text-[15px] font-bold pt-1" style={{ color: INK }}>E o "Meu humor"?</p>
            <p style={{ fontSize: 13, color: MUTED }}>
              No mesmo link você também pode avaliar como está se sentindo: uma nota de 0 a 10 para o dia, as emoções que mais apareceram e um espaço livre para escrever. Juntando o humor com os registros de pensamento, sua psicóloga acompanha sua evolução semana a semana.
            </p>
          </div>
        )}

        {tab === "home" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { id: "form" as const, Icon: Brain, title: "Registro de Pensamentos (RPD)", text: "Algo mexeu com você? Registre a situação, o pensamento e o que sentiu.", cta: "Fazer meu RPD" },
              { id: "mood" as const, Icon: Smile, title: "Meu humor", text: "Como você está hoje? Dê uma nota de 0 a 10 e marque suas emoções.", cta: "Registrar meu humor" },
            ]).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setTab(c.id); window.scrollTo({ top: 0 }); }}
                className="bg-white rounded-[14px] p-5 text-left space-y-2 border-2 transition-transform active:scale-[0.98] hover:-translate-y-0.5"
                style={{ borderColor: `${G}55`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${G}1A` }}><c.Icon className="h-6 w-6" style={{ color: G }} /></span>
                <span className="block font-display text-lg font-bold" style={{ color: INK }}>{c.title}</span>
                <span className="block text-[13px]" style={{ color: MUTED }}>{c.text}</span>
                <span className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold mt-1" style={{ background: G, color: "#fff" }}>{c.cta} →</span>
              </button>
            ))}
            <button type="button" onClick={() => setTab("list")} className="sm:col-span-2 min-h-11 text-sm font-semibold underline" style={{ color: MUTED }}>
              Ver meus registros e minha evolução
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-[10px] bg-white p-1" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {([
            { id: "form" as const, label: "Novo registro", Icon: PenLine },
            { id: "mood" as const, label: "Meu humor", Icon: Smile },
            { id: "list" as const, label: `Meus registros${records.length ? ` (${records.length})` : ""}`, Icon: History },
            { id: "evo" as const, label: "Minha evolução", Icon: TrendingUp },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className="min-h-11 rounded-[8px] px-2 text-[11px] sm:text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
              style={tab === id ? { background: G, color: "#fff" } : { color: MUTED }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
        )}

        {tab === "home" ? null : tab === "mood" ? (
          <PatientMoodSelfReport token={token as string} password={password} accent={G} ink={INK} muted={MUTED} />
        ) : tab === "form" ? (
          <RpdForm value={form} onChange={setForm} accent={G} />
        ) : loadingRecords ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: G }} /></div>
        ) : tab === "list" ? (
          <RpdRecordsRead records={records} accent={G} ink={INK} muted={MUTED} />
        ) : (
          <RpdEvolutionPanel records={records} accent={G} ink={INK} muted={MUTED} />
        )}

        {/* Botão no fluxo (desktop) */}
        <div className={`${tab === "form" ? "hidden md:block" : "hidden"} pb-6`}>
          <Button onClick={submit} disabled={saving} className="w-full min-h-11" style={{ background: G, color: "#fff", fontWeight: 600 }}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enviar registro
          </Button>
        </div>
      </div>

      {/* Barra fixa inferior (mobile) */}
      <div
        className="md:hidden data-[hide=true]:hidden fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-md px-4 pt-3"
        data-hide={tab !== "form"}
        style={{
          background: "rgba(247,246,243,0.95)",
          borderColor: "rgba(0,0,0,0.06)",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        <Button
          onClick={submit}
          disabled={saving}
          className="w-full min-h-12 text-base"
          style={{ background: G, color: "#fff", fontWeight: 600 }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enviar registro
        </Button>
      </div>
    </div>
  );
};


export default RpdPublico;
