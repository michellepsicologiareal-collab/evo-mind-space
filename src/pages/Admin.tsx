import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, Users, Mail, Calendar, Building2, ArrowLeft, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SubStatus = "free" | "pending" | "active";
type ProfileType = "standard" | "supervisee" | "supervisor";

const STATUS_LABELS: Record<SubStatus, string> = {
  free: "Gratuito",
  pending: "Pendente",
  active: "Ativo",
};

const STATUS_STYLES: Record<SubStatus, string> = {
  free: "bg-muted text-muted-foreground",
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
};

const PROFILE_LABELS: Record<ProfileType, string> = {
  standard: "Padrão",
  supervisee: "Supervisionando",
  supervisor: "Supervisor",
};

const PROFILE_STYLES: Record<ProfileType, string> = {
  standard: "bg-muted text-muted-foreground",
  supervisee: "bg-primary/10 text-primary",
  supervisor: "bg-lilac/20 text-lilac-foreground",
};

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  crp: string | null;
  profile_type: string | null;
  clinic_name: string | null;
  subscription_status: SubStatus;
  is_approved: boolean;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAndLoad = async () => {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!role) {
        toast.error("Acesso negado");
        navigate("/app");
        return;
      }

      setAuthorized(true);

      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) {
        toast.error("Erro ao carregar usuários");
        setLoading(false);
        return;
      }
      setUsers(data ?? []);
      setLoading(false);
    };

    checkAndLoad();
  }, [user, authLoading, navigate]);

  const handleStatusChange = async (userId: string, newStatus: SubStatus) => {
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_status: newStatus } as any)
      .eq("id", userId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, subscription_status: newStatus } : u))
    );
    toast.success(`Status alterado para ${STATUS_LABELS[newStatus]}`);
  };

  const handleApproval = async (userId: string, approve: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: approve } as any)
      .eq("id", userId);

    if (error) {
      toast.error("Erro ao atualizar aprovação");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_approved: approve } : u))
    );
    toast.success(approve ? "Usuário aprovado!" : "Acesso revogado");
  };

  const handleProfileTypeChange = async (userId: string, newType: ProfileType) => {
    const { error } = await supabase
      .from("profiles")
      .update({ profile_type: newType } as any)
      .eq("id", userId);

    if (error) {
      toast.error("Erro ao atualizar tipo de perfil");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, profile_type: newType } : u))
    );
    toast.success(`Perfil alterado para ${PROFILE_LABELS[newType]}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) return null;

  const pendingUsers = users.filter((u) => !u.is_approved);
  const approvedUsers = users.filter((u) => u.is_approved);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-up">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-medium">Administração</h1>
              <p className="text-muted-foreground">Painel de gestão do Psi Real</p>
            </div>
          </div>
        </header>

        {/* Pending approval section */}
        {pendingUsers.length > 0 && (
          <section className="rounded-3xl bg-accent/5 border border-accent/20 shadow-card p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <XCircle className="h-5 w-5 text-accent" />
              <h2 className="font-display text-xl font-medium">Aguardando aprovação ({pendingUsers.length})</h2>
            </div>
            <div className="space-y-3">
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 bg-card rounded-2xl border border-border p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{u.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {u.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => handleApproval(u.id, true)}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Approved users section */}
        <section className="rounded-3xl bg-card border border-border shadow-card p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-medium">Psicólogos aprovados ({approvedUsers.length})</h2>
          </div>

          {approvedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum usuário aprovado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Nome</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">CRP</th>
                    <th className="pb-3 pr-4 font-medium">Tipo</th>
                    <th className="pb-3 pr-4 font-medium">Consultório</th>
                    <th className="pb-3 pr-4 font-medium">Assinatura</th>
                    <th className="pb-3 pr-4 font-medium">Cadastro</th>
                    <th className="pb-3 pr-4 font-medium">Último login</th>
                    <th className="pb-3 font-medium">Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 font-medium text-foreground">{u.full_name || "—"}</td>
                      <td className="py-3 pr-4 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.email}
                      </td>
                      <td className="py-3 pr-4">{u.crp || "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.profile_type === "supervisor"
                            ? "bg-lilac/20 text-lilac-foreground"
                            : u.profile_type === "supervisee"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {u.profile_type === "supervisor" ? "Supervisor" : u.profile_type === "supervisee" ? "Supervisionando" : "Padrão"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {u.clinic_name ? (
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{u.clinic_name}</span>
                        ) : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${STATUS_STYLES[u.subscription_status]}`}>
                              {STATUS_LABELS[u.subscription_status]}
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {(Object.keys(STATUS_LABELS) as SubStatus[]).map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => handleStatusChange(u.id, status)}
                                className={u.subscription_status === status ? "font-bold" : ""}
                              >
                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                  status === "active" ? "bg-green-500" : status === "pending" ? "bg-yellow-500" : "bg-gray-400"
                                }`} />
                                {STATUS_LABELS[status]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="py-3 pr-4 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 pr-4">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}
                      </td>
                      <td className="py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproval(u.id, false)}
                          className="text-xs text-destructive hover:text-destructive"
                        >
                          Revogar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Admin;
