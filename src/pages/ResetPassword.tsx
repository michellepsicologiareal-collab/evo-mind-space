import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import logoSrc from "@/assets/logo-psireal.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [countdownCancelled, setCountdownCancelled] = useState(false);

  const returnToLogin = async () => {
    await supabase.auth.signOut({ scope: "local" });
    navigate("/auth?forceLogin=1", { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const validateRecoveryLink = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search);

      // Check for error in URL (expired/invalid link)
      const errorDescription = hashParams.get("error_description") || queryParams.get("error_description");
      const errorCode = hashParams.get("error") || queryParams.get("error");
      if (errorDescription || errorCode) {
        if (!cancelled) setLinkExpired(true);
        return;
      }

      if (hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery" || hashParams.has("access_token")) {
        if (!cancelled) setIsRecovery(true);
        return;
      }

      const recoveryCode = queryParams.get("code");
      if (recoveryCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(recoveryCode);
        if (cancelled) return;

        if (!error) {
          setIsRecovery(true);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setIsRecovery(Boolean(data.session));
        setLinkExpired(!data.session);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      setIsRecovery(Boolean(data.session && window.location.pathname === "/reset-password"));
      setLinkExpired(Boolean(error) || !data.session);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setIsRecovery(true);
        setLinkExpired(false);
      }
    });

    validateRecoveryLink();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Countdown redirect when link is expired
  useEffect(() => {
    if (!linkExpired || countdownCancelled) return;
    if (countdown <= 0) {
      returnToLogin();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [linkExpired, countdown, countdownCancelled, navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("expired") || msg.includes("invalid") || msg.includes("token") || msg.includes("session")) {
        setLinkExpired(true);
      } else {
        toast.error(error.message || "Erro ao redefinir a senha.");
      }
      return;
    }

    setDone(true);
    toast.success("Senha redefinida com sucesso! Entre novamente com a nova senha.");
    setTimeout(() => returnToLogin(), 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2 w-fit">
          <span className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden">
            <img src={logoSrc} alt="Psicologia Real" className="h-9 w-9 object-cover" />
          </span>
          <span className="font-display text-xl font-semibold">
            Psi <span className="italic text-accent">Real</span>
          </span>
        </Link>

        <div className="rounded-3xl bg-card border border-border shadow-card p-8 sm:p-10 space-y-6">
          {done ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage/10">
                <CheckCircle className="h-8 w-8 text-sage" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Senha redefinida!</h1>
              <p className="text-muted-foreground text-sm">
                Você será redirecionado para o login em instantes…
              </p>
            </div>
          ) : linkExpired ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Link expirado ou inválido</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                O link de redefinição de senha expirou ou já foi utilizado.<br />
                Por favor, volte ao login e solicite um novo link clicando em{" "}
                <strong>"Esqueci minha senha"</strong>.
              </p>
              {!countdownCancelled ? (
                <p className="text-muted-foreground text-xs">
                  Redirecionando para o login em{" "}
                  <span className="font-semibold text-foreground">{countdown}s</span>…{" "}
                  <button
                    type="button"
                    onClick={() => setCountdownCancelled(true)}
                    className="underline hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                </p>
              ) : null}
              <Button type="button" variant="accent" className="mt-2 gap-2" onClick={returnToLogin}>
                  <ArrowLeft className="h-4 w-4" /> Solicitar novo link
              </Button>
            </div>
          ) : !isRecovery ? (
            <div className="text-center space-y-4">
              <h1 className="font-display text-2xl font-semibold">Redefinir senha</h1>
              <p className="text-muted-foreground text-sm">
                Aguardando validação do link de recuperação…<br />
                Se você chegou aqui sem clicar no link do email, volte ao login e solicite novamente.
              </p>
              <Button type="button" variant="outline" className="mt-2 gap-2" onClick={returnToLogin}>
                  <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-2xl font-semibold">Nova senha</h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  Escolha uma nova senha segura para sua conta.
                </p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Redefinir senha
                </Button>
              </form>
              <button type="button" onClick={returnToLogin} className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
                Voltar ao login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
