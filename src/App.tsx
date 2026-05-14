import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/app/AppLayout";
import { Loader2 } from "lucide-react";

/* ── Lazy-loaded pages ── */
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const ConfirmarSessao = lazy(() => import("./pages/ConfirmarSessao"));
const SessaoConfirmada = lazy(() => import("./pages/SessaoConfirmada"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Patients = lazy(() => import("./pages/app/Patients"));
const Agenda = lazy(() => import("./pages/app/Agenda"));
const Profile = lazy(() => import("./pages/app/Profile"));
const Finance = lazy(() => import("./pages/app/Finance"));
const Supervisees = lazy(() => import("./pages/app/Supervisees"));
const Library = lazy(() => import("./pages/app/Library"));
const Autocuidado = lazy(() => import("./pages/app/Autocuidado"));
const ContratoModelo = lazy(() => import("./pages/app/ContratoModelo"));
const Contratos = lazy(() => import("./pages/app/Contratos"));
const ComecePorAqui = lazy(() => import("./pages/app/ComecePorAqui"));
const RegistroSessao = lazy(() => import("./pages/app/RegistroSessao"));
const Anamneses = lazy(() => import("./pages/app/Anamneses"));
const ContratoPublico = lazy(() => import("./pages/ContratoPublico"));
const AnamnesePublica = lazy(() => import("./pages/AnamnesePublica"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; retryCount: number }> {
  state = { hasError: false, retryCount: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Erro ao carregar o sistema:", error);

    // Auto-retry up to 3 times before showing the error screen
    if (this.state.retryCount < 3) {
      const nextRetry = this.state.retryCount + 1;
      console.info(`Tentativa automática ${nextRetry}/3...`);
      setTimeout(() => {
        this.setState({ hasError: false, retryCount: nextRetry });
      }, 1000 * nextRetry); // 1s, 2s, 3s backoff
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= 3) {
      // All retries exhausted — redirect to login instead of showing error screen
      window.location.assign("/auth");
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }

    if (this.state.hasError) {
      // Retrying — show spinner
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }

    return this.props.children;
  }
}

const RecoveryLinkRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, ""));
    const isRecoveryLink = params.get("type") === "recovery" || params.has("access_token");

    if (isRecoveryLink && window.location.pathname !== "/reset-password") {
      navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
    }
  }, [navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RecoveryLinkRedirect />
          <Suspense fallback={<PageLoader />}>
            <AppErrorBoundary>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/confirmar-sessao/:token" element={<ConfirmarSessao />} />
              <Route path="/sessao-confirmada/:token" element={<SessaoConfirmada />} />
              <Route path="/contrato/:templateId" element={<ContratoPublico />} />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="pacientes" element={<Patients />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="financeiro" element={<Finance />} />
                <Route path="supervisionandos" element={<Supervisees />} />
                <Route path="biblioteca" element={<Library />} />
                <Route path="autocuidado" element={<Autocuidado />} />
                <Route path="contrato-modelo" element={<ContratoModelo />} />
                <Route path="contratos" element={<Contratos />} />
                <Route path="comece-por-aqui" element={<ComecePorAqui />} />
                <Route path="registro-sessao" element={<RegistroSessao />} />
                <Route path="anamneses" element={<Anamneses />} />
                <Route path="perfil" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
              </Routes>
            </AppErrorBoundary>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
