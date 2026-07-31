import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, X, Lock, ClipboardList, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import logoImg from "@/assets/logo-psireal.png";

const G = "#B8860B";
const INK = "#1A1A2E";
const MUTED = "#6B7280";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "situation", label: "Situação", hint: "O que aconteceu? Onde, quando e com quem?" },
  { key: "automatic_thought", label: "Pensamento automático", hint: "O que passou pela sua cabeça naquele momento?" },
  { key: "emotion", label: "Emoção", hint: "O que você sentiu? Com que intensidade (0 a 100)?" },
  { key: "behavior", label: "Comportamento", hint: "O que você fez em seguida?" },
  { key: "cognitive_distortion", label: "Distorção cognitiva (se souber)", hint: "Ex.: catastrofização, leitura mental..." },
  { key: "rational_response", label: "Resposta racional", hint: "Que outra forma de pensar seria possível?" },
];

const RpdPublico = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "password" | "ready" | "error" | "done">("loading");
  const [info, setInfo] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

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
    if (!FIELDS.some((f) => (form[f.key] || "").trim())) {
      toast.error("Preencha ao menos um campo.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("submit_rpd_by_token", {
      _token: token as string,
      _password: password,
      _payload: form as any,
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
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" maxLength={60} />
          {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={!password.trim()}>Acessar</Button>
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
            className="mt-5"
            onClick={() => { setForm({}); setState("ready"); window.scrollTo({ top: 0 }); }}
          >
            Registrar outro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <img src={logoImg} alt="Psi Real" className="h-8 w-8 object-contain" />
          <span className="font-display text-lg font-bold text-foreground">Psi Real</span>
        </div>

        <div className="bg-white rounded-[10px] p-5 sm:p-6 space-y-1" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>
            TCC · Registro de Pensamentos Disfuncionais
          </p>
          <h1 className="font-display flex items-center gap-2" style={{ fontSize: 20, fontWeight: 700, color: INK }}>
            <ClipboardList className="h-5 w-5" style={{ color: G }} /> RPD
          </h1>
          <p style={{ fontSize: 13, color: MUTED }}>
            {info?.patient_name} · Psicóloga: {info?.therapist_name}{info?.therapist_crp ? ` · CRP ${info.therapist_crp}` : ""}
          </p>
          <p style={{ fontSize: 13, color: MUTED }}>
            Registre uma situação que gerou desconforto. Preencha o que conseguir — não precisa responder tudo.
          </p>
        </div>

        {FIELDS.map((f, idx) => (
          <section key={f.key} className="bg-white rounded-[10px] p-4 sm:p-5 space-y-2" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
            <header className="space-y-0.5">
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>Coluna {idx + 1}</p>
              <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: INK }}>{f.label}</h2>
              <p style={{ fontSize: 12, color: MUTED }}>{f.hint}</p>
            </header>
            <Textarea
              rows={3}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder="Escreva aqui..."
              className="resize-y"
            />
          </section>
        ))}

        <div className="pb-10">
          <Button onClick={submit} disabled={saving} className="w-full" style={{ background: G, color: "#fff", fontWeight: 600 }}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enviar registro
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RpdPublico;
