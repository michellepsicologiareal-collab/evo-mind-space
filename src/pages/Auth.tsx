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
import { Checkbox } from "@/components/ui/checkbox";

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const maskPhoneBR = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nome muito curto").max(100),
    email: z
      .string()
      .trim()
      .min(1, "Informe o e-mail")
      .email("E-mail inválido. Verifique o formato (ex.: nome@dominio.com).")
      .max(255, "E-mail muito longo (máx. 255)"),
    phone: z
      .string()
      .transform((v) => onlyDigits(v))
      .refine((v) => v.length >= 10 && v.length <= 11, {
        message: "WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).",
      }),
    password: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirmPassword: z.string().min(1, "Confirme a senha").max(72),
    professionalProfile: z.enum(["psychologist", "student", "other"], {
      errorMap: () => ({ message: "Selecione o perfil profissional" }),
    }),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Você precisa aceitar os Termos de Uso" }),
    }),
    acceptPrivacy: z.literal(true, {
      errorMap: () => ({ message: "Você precisa aceitar a Política de Privacidade" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
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
  const [suPhone, setSuPhone] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirmPassword, setSuConfirmPassword] = useState("");
  const [suProfessionalProfile, setSuProfessionalProfile] = useState<"psychologist" | "student" | "other">("psychologist");
  const [suAcceptTerms, setSuAcceptTerms] = useState(false);
  const [suAcceptPrivacy, setSuAcceptPrivacy] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [suErrors, setSuErrors] = useState<Record<string, string>>({});
  const [suPhoneWarning, setSuPhoneWarning] = useState<string | null>(null);


  useEffect(() => {
    if (searchParams.get("forceLogin") === "1") {
      setSearchParams({}, { replace: true });
      return;
    }

    if (user) navigate(returnUrlRef.current || "/app", { replace: true });
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
    navigate(returnUrlRef.current || "/app", { replace: true });
    returnUrlRef.current = null;
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

  const checkAvailability = async (email: string, phoneDigits: string) => {
    try {
      const { data, error } = await (supabase as any).rpc("check_signup_availability", {
        _email: email,
        _phone_digits: phoneDigits,
      });
      if (error) return { emailExists: false, phoneExists: false };
      const row = Array.isArray(data) ? data[0] : data;
      return {
        emailExists: Boolean(row?.email_exists),
        phoneExists: Boolean(row?.phone_exists),
      };
    } catch {
      return { emailExists: false, phoneExists: false };
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuErrors({});
    setSuPhoneWarning(null);
    const parsed = signUpSchema.safeParse({
      fullName: suName,
      email: suEmail.trim(),
      phone: suPhone,
      password: suPassword,
      confirmPassword: suConfirmPassword,
      professionalProfile: suProfessionalProfile,
      acceptTerms: suAcceptTerms,
      acceptPrivacy: suAcceptPrivacy,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setSuErrors(fieldErrors);
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);

    // Duplicate checks (email = blocking; phone = warn only)
    const availability = await checkAvailability(parsed.data.email, parsed.data.phone);
    if (availability.emailExists) {
      setSuErrors({ email: "Este e-mail já está cadastrado." });
      setLoading(false);
      toast.error("Este e-mail já está cadastrado.");
      return;
    }
    if (availability.phoneExists && suPhoneWarning === null) {
      setSuPhoneWarning("Este WhatsApp já está cadastrado. Se for número compartilhado da clínica, clique em “Criar minha conta” novamente para prosseguir.");
      setLoading(false);
      return;
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
          professional_profile: parsed.data.professionalProfile,
          profile_type: "standard",
          terms_accepted_at: nowIso,
          privacy_accepted_at: nowIso,
          registered_at: nowIso,
        },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        setSuErrors({ email: "Este e-mail já está cadastrado." });
        toast.error("Este e-mail já está cadastrado.");
      } else if (msg.toLowerCase().includes("termos")) {
        toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade");
      } else {
        toast.error(msg);
      }
      return;
    }
    setSignupDone(true);
    toast.success("Cadastro realizado. Seu acesso será liberado em breve.");
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
              {signupDone ? (
                <div className="text-center space-y-4 py-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/10">
                    <ArrowLeft className="h-6 w-6 text-sage rotate-180" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">Cadastro realizado</h3>
                  <p className="text-sm text-muted-foreground">
                    Seu acesso será liberado em breve.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Você receberá uma confirmação assim que a liberação for feita.
                  </p>
                </div>
              ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nome completo</Label>
                  <Input
                    id="su-name"
                    required
                    value={suName}
                    onChange={(e) => { setSuName(e.target.value); if (suErrors.fullName) setSuErrors((p) => ({ ...p, fullName: "" })); }}
                    aria-invalid={!!suErrors.fullName}
                    aria-describedby={suErrors.fullName ? "su-name-error" : undefined}
                  />
                  {suErrors.fullName && <p id="su-name-error" className="text-xs text-destructive">{suErrors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input
                    id="su-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={suEmail}
                    onChange={(e) => { setSuEmail(e.target.value); if (suErrors.email) setSuErrors((p) => ({ ...p, email: "" })); }}
                    onBlur={(e) => setSuEmail(e.target.value.trim())}
                    aria-invalid={!!suErrors.email}
                    aria-describedby={suErrors.email ? "su-email-error" : undefined}
                  />
                  {suErrors.email && <p id="su-email-error" className="text-xs text-destructive">{suErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-phone">Celular / WhatsApp</Label>
                  <Input
                    id="su-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    placeholder="(11) 99999-9999"
                    value={maskPhoneBR(suPhone)}
                    onChange={(e) => {
                      setSuPhone(onlyDigits(e.target.value).slice(0, 11));
                      if (suErrors.phone) setSuErrors((p) => ({ ...p, phone: "" }));
                      if (suPhoneWarning) setSuPhoneWarning(null);
                    }}
                    aria-invalid={!!suErrors.phone}
                    aria-describedby={suErrors.phone ? "su-phone-error" : suPhoneWarning ? "su-phone-warning" : undefined}
                  />
                  {suErrors.phone && <p id="su-phone-error" className="text-xs text-destructive">{suErrors.phone}</p>}
                  {!suErrors.phone && suPhoneWarning && (
                    <p id="su-phone-warning" className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-2 py-1.5">
                      {suPhoneWarning}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Perfil profissional</Label>
                  <RadioGroup
                    value={suProfessionalProfile}
                    onValueChange={(v) => setSuProfessionalProfile(v as "psychologist" | "student" | "other")}
                    className="grid gap-2"
                  >
                    {[
                      { id: "pp-psychologist", value: "psychologist", label: "Psicólogo(a)" },
                      { id: "pp-student", value: "student", label: "Estudante de Psicologia" },
                      { id: "pp-other", value: "other", label: "Outro" },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        htmlFor={opt.id}
                        className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                          suProfessionalProfile === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                        }`}
                      >
                        <RadioGroupItem id={opt.id} value={opt.value} />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Senha</Label>
                  <Input
                    id="su-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={suPassword}
                    onChange={(e) => { setSuPassword(e.target.value); if (suErrors.password) setSuErrors((p) => ({ ...p, password: "" })); }}
                    aria-invalid={!!suErrors.password}
                    aria-describedby={suErrors.password ? "su-password-error" : undefined}
                  />
                  {suErrors.password
                    ? <p id="su-password-error" className="text-xs text-destructive">{suErrors.password}</p>
                    : <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-confirm-password">Confirmar senha</Label>
                  <Input
                    id="su-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={suConfirmPassword}
                    onChange={(e) => { setSuConfirmPassword(e.target.value); if (suErrors.confirmPassword) setSuErrors((p) => ({ ...p, confirmPassword: "" })); }}
                    aria-invalid={!!suErrors.confirmPassword}
                    aria-describedby={suErrors.confirmPassword ? "su-confirm-error" : undefined}
                  />
                  {suErrors.confirmPassword && <p id="su-confirm-error" className="text-xs text-destructive">{suErrors.confirmPassword}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                    <Checkbox
                      id="su-terms"
                      checked={suAcceptTerms}
                      onCheckedChange={(v) => setSuAcceptTerms(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="su-terms" className="text-sm font-normal leading-relaxed cursor-pointer">
                      Li e aceito os{" "}
                      <a href="/termos.html" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
                        Termos de Uso
                      </a>.
                    </Label>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                    <Checkbox
                      id="su-privacy"
                      checked={suAcceptPrivacy}
                      onCheckedChange={(v) => setSuAcceptPrivacy(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="su-privacy" className="text-sm font-normal leading-relaxed cursor-pointer">
                      Li e aceito a{" "}
                      <a href="/privacidade.html" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">
                        Política de Privacidade
                      </a>.
                    </Label>
                  </div>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || !suAcceptTerms || !suAcceptPrivacy}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar minha conta
                </Button>
              </form>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Auth;
