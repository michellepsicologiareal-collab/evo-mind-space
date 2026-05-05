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
  "/app/financeiro": lazy(() => import("@/pages/app/Finance")),
  "/app/supervisionandos": lazy(() => import("@/pages/app/Supervisees")),
  "/app/biblioteca": lazy(() => import("@/pages/app/Library")),
  "/app/autocuidado": lazy(() => import("@/pages/app/Autocuidado")),
  "/app/contrato-modelo": lazy(() => import("@/pages/app/ContratoModelo")),
  "/app/contratos": lazy(() => import("@/pages/app/Contratos")),
  "/app/comece-por-aqui": lazy(() => import("@/pages/app/ComecePorAqui")),
  "/app/registro-sessao": lazy(() => import("@/pages/app/RegistroSessao")),
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

  // Track visited routes
  if (routeComponents[pathname]) {
    visitedRef.current.add(pathname);
  }

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
