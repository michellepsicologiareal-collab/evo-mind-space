import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Patients = lazy(() => import("./pages/app/Patients"));
const Agenda = lazy(() => import("./pages/app/Agenda"));
const Profile = lazy(() => import("./pages/app/Profile"));
const Finance = lazy(() => import("./pages/app/Finance"));
const Supervisees = lazy(() => import("./pages/app/Supervisees"));
const Supervision = lazy(() => import("./pages/app/Supervision"));
const SupervisaoCaso = lazy(() => import("./pages/app/SupervisaoCaso"));
const Library = lazy(() => import("./pages/app/Library"));
const Autocuidado = lazy(() => import("./pages/app/Autocuidado"));
const ContratoModelo = lazy(() => import("./pages/app/ContratoModelo"));
const Contratos = lazy(() => import("./pages/app/Contratos"));
const ContratoPublico = lazy(() => import("./pages/ContratoPublico"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/confirmar-sessao/:token" element={<ConfirmarSessao />} />
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
                <Route path="supervisao" element={<Supervision />} />
                <Route path="supervisao-caso" element={<SupervisaoCaso />} />
                <Route path="biblioteca" element={<Library />} />
                <Route path="autocuidado" element={<Autocuidado />} />
                <Route path="contrato-modelo" element={<ContratoModelo />} />
                <Route path="contratos" element={<Contratos />} />
                <Route path="perfil" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
