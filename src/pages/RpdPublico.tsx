import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, X, Lock, ClipboardList, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RpdForm } from "@/components/app/RpdForm";
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
      setState(meta.password_required ? "password" : "ready");
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
          onSubmit={(e) => { e.preventDefault(); if (password.trim()) { setPwdError(null); setState("ready"); } }}
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
            onClick={() => { setForm(emptyRpdForm()); setState("ready"); window.scrollTo({ top: 0 }); }}

          >
            Registrar outro
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2">
          <img src={logoImg} alt="Psi Real" className="h-7 w-7 object-contain shrink-0" />
          <span className="font-display text-base font-bold text-foreground">Psi Real</span>
          <span className="ml-auto text-[11px] font-semibold" style={{ color: MUTED }}>
            Registro de Pensamentos
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 space-y-3 sm:space-y-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
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
            Use este espaço para entender uma situação que mexeu com você. Não precisa preencher perfeitamente: registre o que você percebeu naquele momento.
          </p>
        </div>

        <RpdForm value={form} onChange={setForm} accent={G} />

        {/* Botão no fluxo (desktop) */}
        <div className="hidden md:block pb-6">
          <Button onClick={submit} disabled={saving} className="w-full min-h-11" style={{ background: G, color: "#fff", fontWeight: 600 }}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enviar registro
          </Button>
        </div>
      </div>

      {/* Barra fixa inferior (mobile) */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-md px-4 pt-3"
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
