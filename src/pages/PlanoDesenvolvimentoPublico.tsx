import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, X, Lock, GraduationCap, CheckCircle2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Activity {
  text: string;
  done: boolean;
}

interface Plan {
  id: string;
  title: string;
  skill: string | null;
  evidence: string | null;
  objective: string | null;
  activities: Activity[] | null;
  materials: string | null;
  supervisor_feedback: string | null;
  supervisee_reflection: string | null;
  supervisee_feedback: string | null;
  status: string;
  due_date: string | null;
  supervisor_name: string | null;
}

const PlanoDesenvolvimentoPublico = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "password" | "ready" | "error" | "done">("loading");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reflection, setReflection] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Plano de Desenvolvimento | Psi Real";
    return () => { document.title = "Psi Real — Gestão Inteligente para Psicólogos"; };
  }, []);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_dev_plan_link_info", { _token: token });
      const meta = (data as any[])?.[0];
      if (error || !meta?.exists_flag) { setState("error"); return; }
      setPasswordRequired(!!meta.password_required);
      if (meta.password_required) {
        setState("password");
      } else {
        loadPlan("");
      }
    })();
    // eslint-disable-next-line
  }, [token]);

  const loadPlan = async (pwd: string) => {
    const { data, error } = await (supabase as any).rpc("get_dev_plan_by_token", {
      _token: token,
      _password: pwd,
    });
    const row = (data as any[])?.[0];
    if (error || !row) {
      if (passwordRequired) { setPwdError("Senha incorreta."); setState("password"); return; }
      setState("error");
      return;
    }
    setPlan(row as Plan);
    setActivities((row.activities as Activity[]) ?? []);
    setReflection(row.supervisee_reflection ?? "");
    setFeedback(row.supervisee_feedback ?? "");
    setState("ready");
  };

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase as any).rpc("submit_dev_plan_response", {
      _token: token,
      _password: password,
      _activities: activities,
      _reflection: reflection,
      _feedback: feedback,
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl bg-card border border-border p-8">
          <X className="h-12 w-12 mx-auto text-destructive/40 mb-4" />
          <h2 className="font-display text-xl font-bold">Link inválido, revogado ou expirado</h2>
          <p className="mt-2 text-muted-foreground">Peça um novo link ao seu supervisor(a).</p>
        </div>
      </div>
    );
  }

  if (state === "password") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="text-center space-y-2">
            <Lock className="h-8 w-8 mx-auto text-primary" />
            <h2 className="font-display text-lg font-bold">Plano protegido</h2>
            <p className="text-sm text-muted-foreground">Informe a senha enviada pelo seu supervisor(a).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd">Senha</Label>
            <Input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwdError(null); }}
              onKeyDown={(e) => e.key === "Enter" && loadPlan(password)}
            />
            {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
          </div>
          <Button className="w-full" onClick={() => loadPlan(password)}>Acessar plano</Button>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl bg-card border border-border p-8">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
          <h2 className="font-display text-xl font-bold">Enviado com sucesso</h2>
          <p className="mt-2 text-muted-foreground">
            Seu supervisor(a) receberá o progresso e a devolutiva registrada.
          </p>
        </div>
      </div>
    );
  }

  const done = activities.filter((a) => a.done).length;
  const progress = activities.length ? Math.round((done / activities.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold truncate">Plano de Desenvolvimento</h1>
            <p className="text-xs text-muted-foreground truncate">
              {plan?.supervisor_name ? `Supervisão: ${plan.supervisor_name}` : "Supervisão clínica"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <h2 className="font-display text-xl font-bold">{plan?.title}</h2>
          {plan?.skill && (
            <p className="text-sm"><span className="font-medium">Competência: </span>{plan.skill}</p>
          )}
          {plan?.objective && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              <span className="font-medium text-foreground">Objetivo: </span>{plan.objective}
            </p>
          )}
          {plan?.evidence && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              <span className="font-medium text-foreground">Evidências observadas: </span>{plan.evidence}
            </p>
          )}
          {plan?.materials && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              <span className="font-medium text-foreground">Materiais / orientações: </span>{plan.materials}
            </p>
          )}
          {plan?.supervisor_feedback && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-xl bg-secondary/40 p-3">
              <span className="font-medium text-foreground">Feedback do supervisor: </span>{plan.supervisor_feedback}
            </p>
          )}
          {plan?.due_date && (
            <p className="text-xs text-muted-foreground">Prazo: {plan.due_date.split("-").reverse().join("/")}</p>
          )}
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Atividades práticas</h3>
            <span className="text-xs text-muted-foreground">{done}/{activities.length} · {progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada.</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {activities.map((a, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-secondary/40 p-3">
                  <Checkbox
                    checked={a.done}
                    onCheckedChange={(v) =>
                      setActivities((prev) => prev.map((x, xi) => (xi === i ? { ...x, done: !!v } : x)))
                    }
                    className="mt-0.5"
                  />
                  <span className={`text-sm ${a.done ? "line-through text-muted-foreground" : ""}`}>{a.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Reflexões e dificuldades</Label>
            <Textarea rows={4} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="O que percebeu ao praticar? O que foi mais difícil?" />
          </div>
          <div className="space-y-1.5">
            <Label>Devolutiva ao supervisor</Label>
            <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="O que gostaria de levar para a próxima supervisão?" />
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur p-4">
        <div className="max-w-2xl mx-auto">
          <Button className="w-full" size="lg" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar ao supervisor
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanoDesenvolvimentoPublico;
