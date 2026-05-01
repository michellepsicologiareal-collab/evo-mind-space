import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Shield, Users, Mail, Calendar, Building2, ArrowLeft,
  ChevronDown, CheckCircle2, XCircle, Search, FileText, UserCheck,
  Eye, Activity, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  supervisor_id: string | null;
  supervisor_name: string | null;
  phone: string | null;
  specialty: string | null;
  patient_count: number;
  session_count: number;
}

interface AuditLog {
  id: string;
  user_id: string;
  resource_type: string;
  access_type: string;
  result: string;
  block_reason: string | null;
  created_at: string;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [search, setSearch] = useState("");
  const [logUserId, setLogUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }

    const checkAndLoad = async () => {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!role) { toast.error("Acesso negado"); navigate("/app"); return; }
      setAuthorized(true);

      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) { toast.error("Erro ao carregar usuários"); setLoading(false); return; }
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
    if (error) { toast.error("Erro ao atualizar status"); return; }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, subscription_status: newStatus } : u)));
    toast.success(`Status alterado para ${STATUS_LABELS[newStatus]}`);
  };

  const handleApproval = async (userId: string, approve: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: approve } as any)
      .eq("id", userId);
    if (error) { toast.error("Erro ao atualizar aprovação"); return; }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_approved: approve } : u)));
    toast.success(approve ? "Usuário aprovado!" : "Acesso revogado");
  };

  const handleProfileTypeChange = async (userId: string, newType: ProfileType) => {
    const { error } = await supabase
      .from("profiles")
      .update({ profile_type: newType } as any)
      .eq("id", userId);
    if (error) { toast.error("Erro ao atualizar tipo de perfil"); return; }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, profile_type: newType } : u)));
    toast.success(`Perfil alterado para ${PROFILE_LABELS[newType]}`);
  };

  const openLogs = async (userId: string) => {
    setLogUserId(userId);
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, user_id, resource_type, access_type, result, block_reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro ao carregar logs");
    setLogs((data as AuditLog[]) ?? []);
    setLogsLoading(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.crp ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const pendingUsers = useMemo(() => filtered.filter((u) => !u.is_approved), [filtered]);
  const approvedUsers = useMemo(() => filtered.filter((u) => u.is_approved), [filtered]);
  const supervisors = useMemo(() => filtered.filter((u) => u.profile_type === "supervisor"), [filtered]);
  const supervisees = useMemo(() => filtered.filter((u) => u.profile_type === "supervisee"), [filtered]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) return null;

  const logUser = users.find((u) => u.id === logUserId);

  // Shared user row renderer
  const UserRow = ({ u, showSupervisor = false }: { u: AdminUser; showSupervisor?: boolean }) => (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{u.full_name || "—"}</td>
      <td className="py-3 pr-4 text-sm">
        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{u.email}</span>
      </td>
      <td className="py-3 pr-4 text-sm">{u.crp || "—"}</td>
      <td className="py-3 pr-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${PROFILE_STYLES[(u.profile_type as ProfileType) || "standard"]}`}>
              {PROFILE_LABELS[(u.profile_type as ProfileType) || "standard"]}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(PROFILE_LABELS) as ProfileType[]).map((type) => (
              <DropdownMenuItem key={type} onClick={() => handleProfileTypeChange(u.id, type)} className={u.profile_type === type ? "font-bold" : ""}>
                {PROFILE_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
              <DropdownMenuItem key={status} onClick={() => handleStatusChange(u.id, status)} className={u.subscription_status === status ? "font-bold" : ""}>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${status === "active" ? "bg-green-500" : status === "pending" ? "bg-yellow-500" : "bg-gray-400"}`} />
                {STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
      <td className="py-3 pr-4 text-sm text-center">{u.patient_count}</td>
      <td className="py-3 pr-4 text-sm text-center">{u.session_count}</td>
      {showSupervisor && (
        <td className="py-3 pr-4 text-sm">{u.supervisor_name || "—"}</td>
      )}
      <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}
      </td>
      <td className="py-3 flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => openLogs(u.id)} title="Ver logs">
          <Eye className="h-4 w-4" />
        </Button>
        {u.is_approved ? (
          <Button size="sm" variant="outline" onClick={() => handleApproval(u.id, false)} className="text-xs text-destructive hover:text-destructive">
            Revogar
          </Button>
        ) : (
          <Button size="sm" variant="accent" onClick={() => handleApproval(u.id, true)} className="gap-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
          </Button>
        )}
      </td>
    </tr>
  );

  const TableHead = ({ showSupervisor = false }: { showSupervisor?: boolean }) => (
    <thead>
      <tr className="border-b border-border text-left text-muted-foreground text-xs">
        <th className="pb-3 pr-4 font-medium">Nome</th>
        <th className="pb-3 pr-4 font-medium">Email</th>
        <th className="pb-3 pr-4 font-medium">CRP</th>
        <th className="pb-3 pr-4 font-medium">Perfil</th>
        <th className="pb-3 pr-4 font-medium">Assinatura</th>
        <th className="pb-3 pr-4 font-medium text-center">Pacientes</th>
        <th className="pb-3 pr-4 font-medium text-center">Sessões</th>
        {showSupervisor && <th className="pb-3 pr-4 font-medium">Supervisor</th>}
        <th className="pb-3 pr-4 font-medium">Último login</th>
        <th className="pb-3 font-medium">Ações</th>
      </tr>
    </thead>
  );

  const EmptyState = ({ msg }: { msg: string }) => (
    <p className="text-muted-foreground text-center py-8">{msg}</p>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-up">
        {/* Header */}
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
              <p className="text-muted-foreground text-sm">Painel de gestão do Psi Real</p>
            </div>
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total usuários", value: users.length, icon: Users },
            { label: "Aguardando aprovação", value: users.filter((u) => !u.is_approved).length, icon: XCircle },
            { label: "Supervisores", value: users.filter((u) => u.profile_type === "supervisor").length, icon: UserCheck },
            { label: "Supervisionandos", value: users.filter((u) => u.profile_type === "supervisee").length, icon: Activity },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CRP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Pending approval alert */}
        {pendingUsers.length > 0 && (
          <section className="rounded-2xl bg-accent/5 border border-accent/20 shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-medium">Aguardando aprovação ({pendingUsers.length})</h2>
            </div>
            <div className="space-y-2">
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 bg-card rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate text-sm">{u.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${PROFILE_STYLES[(u.profile_type as ProfileType) || "standard"]}`}>
                          {PROFILE_LABELS[(u.profile_type as ProfileType) || "standard"]}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(Object.keys(PROFILE_LABELS) as ProfileType[]).map((type) => (
                          <DropdownMenuItem key={type} onClick={() => handleProfileTypeChange(u.id, type)} className={u.profile_type === type ? "font-bold" : ""}>
                            {PROFILE_LABELS[type]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" variant="accent" onClick={() => handleApproval(u.id, true)} className="gap-1 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todos ({approvedUsers.length})</TabsTrigger>
            <TabsTrigger value="supervisors">Supervisores ({supervisors.length})</TabsTrigger>
            <TabsTrigger value="supervisees">Supervisionandos ({supervisees.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <section className="rounded-2xl bg-card border border-border shadow-card p-5 overflow-x-auto">
              {approvedUsers.length === 0 ? (
                <EmptyState msg="Nenhum usuário encontrado." />
              ) : (
                <table className="w-full text-sm">
                  <TableHead />
                  <tbody>
                    {approvedUsers.map((u) => <UserRow key={u.id} u={u} />)}
                  </tbody>
                </table>
              )}
            </section>
          </TabsContent>

          <TabsContent value="supervisors">
            <section className="rounded-2xl bg-card border border-border shadow-card p-5 overflow-x-auto">
              {supervisors.length === 0 ? (
                <EmptyState msg="Nenhum supervisor encontrado." />
              ) : (
                <table className="w-full text-sm">
                  <TableHead />
                  <tbody>
                    {supervisors.map((u) => <UserRow key={u.id} u={u} />)}
                  </tbody>
                </table>
              )}
            </section>
          </TabsContent>

          <TabsContent value="supervisees">
            <section className="rounded-2xl bg-card border border-border shadow-card p-5 overflow-x-auto">
              {supervisees.length === 0 ? (
                <EmptyState msg="Nenhum supervisionando encontrado." />
              ) : (
                <table className="w-full text-sm">
                  <TableHead showSupervisor />
                  <tbody>
                    {supervisees.map((u) => <UserRow key={u.id} u={u} showSupervisor />)}
                  </tbody>
                </table>
              )}
            </section>
          </TabsContent>
        </Tabs>

        {/* Audit Log Dialog */}
        <Dialog open={!!logUserId} onOpenChange={() => setLogUserId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs — {logUser?.full_name || logUser?.email || "Usuário"}
              </DialogTitle>
            </DialogHeader>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Data</th>
                    <th className="pb-2 pr-3 font-medium">Recurso</th>
                    <th className="pb-2 pr-3 font-medium">Tipo</th>
                    <th className="pb-2 pr-3 font-medium">Resultado</th>
                    <th className="pb-2 font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/30">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                      <td className="py-2 pr-3">{log.resource_type}</td>
                      <td className="py-2 pr-3">{log.access_type}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${log.result === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {log.result === "success" ? "Sucesso" : "Bloqueado"}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{log.block_reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
