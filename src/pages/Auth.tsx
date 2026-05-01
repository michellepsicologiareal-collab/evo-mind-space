import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Brain, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // sign up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suProfileType, setSuProfileType] = useState<"standard" | "supervisee">("standard");

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

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
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15 backdrop-blur">
            <Brain className="h-5 w-5" />
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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
              <Brain className="h-4 w-4" />
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
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" autoComplete="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-password">Senha</Label>
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
