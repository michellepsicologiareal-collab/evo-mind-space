import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isApproved, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Allow admin route even if not approved (admin is auto-approved anyway)
  if (location.pathname === "/admin") {
    return <>{children}</>;
  }

  if (isApproved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Clock className="h-8 w-8 text-accent" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Conta pendente de aprovação
          </h1>
          <p className="text-muted-foreground">
            Sua conta foi criada com sucesso! Estamos aguardando a aprovação da administradora para liberar seu acesso ao sistema.
          </p>
          <p className="text-sm text-muted-foreground">
            Você será notificado quando sua conta for aprovada. Obrigado pela paciência! 💜
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
