import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, Users, Mail, Calendar, Building2, ArrowLeft, ChevronDown } from "lucide-react";
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) return null;

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

        <section className="rounded-3xl bg-card border border-border shadow-card p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-medium">Psicólogos cadastrados ({users.length})</h2>
          </div>

          {users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum usuário cadastrado ainda.</p>
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
                    <th className="pb-3 font-medium">Último login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
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
                      <td className="py-3">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}
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
