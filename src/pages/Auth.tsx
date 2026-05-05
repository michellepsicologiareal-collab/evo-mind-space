import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import logoSrc from "@/assets/logo-psireal.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSessionExpiredFlag, getReturnUrl } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  profileType: z.enum(["standard", "supervisee"]),
});

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const returnUrlRef = useRef<string | null>(null);

  // Check for expired session on mount
  useEffect(() => {
    const expired = getSessionExpiredFlag();
    const returnUrl = getReturnUrl();
    if (expired) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      returnUrlRef.current = returnUrl;
    }
  }, []);

  // sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // sign up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suProfileType, setSuProfileType] = useState<"standard" | "supervisee">("standard");

  useEffect(() => {
    if (searchParams.get("forceLogin") === "1") {
      setSearchParams({}, { replace: true });
      return;
    }

    if (user) navigate("/app", { replace: true });
  }, [user, navigate, searchParams, setSearchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    const parsed = signInSchema.safeParse({ email: siEmail, password: siPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setLoading(false);
    if (error) {
      setLoginError(true);
      toast.error(error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate("/app", { replace: true });
  };

  const handleRetry = () => {
    setLoginError(false);
    setSiPassword("");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Informe seu email.");
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(error.message || "Erro ao enviar email de recuperação.");
      return;
    }
    setForgotSent(true);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({
      fullName: suName,
      email: suEmail,
      password: suPassword,
      profileType: suProfileType,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: parsed.data.fullName,
          profile_type: parsed.data.profileType,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already") ? "Este email já está cadastrado" : error.message);
      return;
    }
    toast.success("Conta criada! Aguarde a aprovação da administradora para acessar o sistema.");
  };

  return (
    <div className="min-h-screen flex bg-gradient-soft">
      {/* Brand panel */}
      <aside className="hidden lg:flex lg:w-1/2 bg-gradient-hero text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-glow/40 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2 w-fit">
          <span className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden">
            <img src={logoSrc} alt="Psicologia Real" className="h-10 w-10 object-cover" />
          </span>
          <span className="font-display text-2xl font-semibold">
            Psi <span className="italic text-accent">Real</span>
          </span>
        </Link>

        <div className="relative">
          <h2 className="font-display text-5xl font-medium leading-tight text-balance">
            Estrutura para a sua clínica.
            <br />
            <span className="italic text-accent">Clareza para suas decisões.</span>
          </h2>
          <p className="mt-6 text-primary-foreground/80 max-w-md">
            Agenda, financeiro e raciocínio clínico em TCC — num só ambiente.
          </p>
        </div>

        <Link to="/" className="relative inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground w-fit">
          <ArrowLeft className="h-4 w-4" /> Voltar para o site
        </Link>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden mb-6 flex items-center gap-2 w-fit">
            <span className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden">
              <img src={logoSrc} alt="Psicologia Real" className="h-9 w-9 object-cover" />
            </span>
            <span className="font-display text-xl font-semibold">
              Psi <span className="italic text-accent">Real</span>
            </span>
          </Link>

          <h1 className="font-display text-3xl font-semibold">Acesse sua conta</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Bem-vindo. Entre ou crie uma conta gratuita para começar.
          </p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid grid-cols-2 w-full bg-secondary">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              {forgotMode ? (
                forgotSent ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/10">
                      <ArrowLeft className="h-6 w-6 text-sage" />
                    </div>
                    <h3 className="font-display text-lg font-semibold">Email enviado!</h3>
                    <p className="text-sm text-muted-foreground">
                      Verifique sua caixa de entrada (e spam) e clique no link de recuperação.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}>
                      Voltar ao login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Informe seu email e enviaremos um link para redefinir sua senha.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input id="forgot-email" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                    </div>
                    <Button type="submit" variant="accent" size="lg" className="w-full" disabled={forgotLoading}>
                      {forgotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar link de recuperação
                    </Button>
                    <button type="button" onClick={() => setForgotMode(false)} className="block mx-auto text-sm text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
                      Voltar ao login
                    </button>
                  </form>
                )
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" autoComplete="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-password">Senha</Label>
                      <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-accent hover:underline">
                        Esqueci minha senha
                      </button>
                    </div>
                    <Input id="si-password" type="password" autoComplete="current-password" required value={siPassword} onChange={(e) => setSiPassword(e.target.value)} />
                  </div>
                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                  {loginError && (
                    <div className="text-center space-y-2">
                      <p className="text-sm text-destructive">Email ou senha incorretos.</p>
                      <Button type="button" variant="outline" size="sm" onClick={handleRetry} className="mx-auto">
                        Tentar novamente
                      </Button>
                    </div>
                  )}
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nome completo</Label>
                  <Input id="su-name" required value={suName} onChange={(e) => setSuName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" autoComplete="email" required value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Senha</Label>
                  <Input id="su-password" type="password" autoComplete="new-password" required value={suPassword} onChange={(e) => setSuPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de perfil</Label>
                  <RadioGroup
                    value={suProfileType}
                    onValueChange={(v) => setSuProfileType(v as "standard" | "supervisee")}
                    className="grid sm:grid-cols-2 gap-2"
                  >
                    <label
                      htmlFor="pt-standard"
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        suProfileType === "standard" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <RadioGroupItem id="pt-standard" value="standard" className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium block">Padrão</span>
                        <span className="text-xs text-muted-foreground">Psicólogo autônomo, gerencia seus próprios pacientes.</span>
                      </span>
                    </label>
                    <label
                      htmlFor="pt-supervisee"
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        suProfileType === "supervisee" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <RadioGroupItem id="pt-supervisee" value="supervisee" className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium block">Membro Parceiro / Supervisionando</span>
                        <span className="text-xs text-muted-foreground">Pode vincular um supervisor que verá seus dados em modo leitura.</span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Auth;
