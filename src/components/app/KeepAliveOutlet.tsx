import { useRef, useEffect, Suspense, lazy, type ComponentType } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Keep-alive outlet: once a route is visited, its component stays mounted
 * but hidden (display:none) when navigating away, preserving local state.
 */

const routeComponents: Record<string, ComponentType> = {
  "/app": lazy(() => import("@/pages/app/Dashboard")),
  "/app/pacientes": lazy(() => import("@/pages/app/Patients")),
  "/app/agenda": lazy(() => import("@/pages/app/Agenda")),
  "/app/humor": lazy(() => import("@/pages/app/Humor")),
  "/app/plano-tratamento": lazy(() => import("@/pages/app/PlanoTratamento")),
  "/app/financeiro": lazy(() => import("@/pages/app/Finance")),
  "/app/supervisionandos": lazy(() => import("@/pages/app/Supervisees")),
  "/app/biblioteca": lazy(() => import("@/pages/app/Library")),
  "/app/autocuidado": lazy(() => import("@/pages/app/Autocuidado")),
  "/app/contrato-modelo": lazy(() => import("@/pages/app/ContratoModelo")),
  "/app/contratos": lazy(() => import("@/pages/app/Contratos")),
  "/app/comece-por-aqui": lazy(() => import("@/pages/app/ComecePorAqui")),
  "/app/registro-sessao": lazy(() => import("@/pages/app/RegistroSessao")),
  "/app/anamneses": lazy(() => import("@/pages/app/Anamneses")),
  "/app/pacientes/:id/formulacao-te": lazy(() => import("@/pages/app/FormulacaoTE")),
  "/app/pacientes/:id/formulacao-act": lazy(() => import("@/pages/app/FormulacaoACT")),
  "/app/perfil": lazy(() => import("@/pages/app/Profile")),
};

const Fallback = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

export const KeepAliveOutlet = () => {
  const { pathname } = useLocation();
  const visitedRef = useRef<Set<string>>(new Set());
  const prevPathRef = useRef<string | null>(null);

  // Track visited routes
  if (routeComponents[pathname]) {
    visitedRef.current.add(pathname);
  }

  // Notify hidden→visible page transitions so it can refresh stale data
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      window.dispatchEvent(new CustomEvent("route-active", { detail: { path: pathname } }));
    }
  }, [pathname]);

  return (
    <>
      {Array.from(visitedRef.current).map((path) => {
        const Comp = routeComponents[path];
        if (!Comp) return null;
        return (
          <div key={path} style={{ display: pathname === path ? "block" : "none" }}>
            <Suspense fallback={<Fallback />}>
              <Comp />
            </Suspense>
          </div>
        );
      })}
    </>
  );
};
