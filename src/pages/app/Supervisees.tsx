import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Users, X, Mail, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SuperviseeRow {
  id: string;
  full_name: string | null;
  activePatients: number;
}

const Supervisees = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [supervisees, setSupervisees] = useState<SuperviseeRow[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("supervisor_id", user.id)
      .eq("profile_type", "supervisee");

    if (error) {
      toast.error("Erro ao carregar supervisionandos");
      setLoading(false);
      return;
    }

    const ids = (profs ?? []).map((p) => p.id);
    let countsByUser: Record<string, number> = {};
    if (ids.length) {
      const { data: pats } = await supabase
        .from("patients")
        .select("user_id")
        .in("user_id", ids)
        .eq("is_active", true);
      (pats ?? []).forEach((p) => {
        countsByUser[p.user_id] = (countsByUser[p.user_id] ?? 0) + 1;
      });
    }

    setSupervisees(
      (profs ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        activePatients: countsByUser[p.id] ?? 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user]);

  const handleInvite = async () => {
    const target = email.trim().toLowerCase();
    if (!target) {
      toast.error("Informe o email do supervisionando");
      return;
    }
    setLinking(true);
    const { error } = await (supabase.rpc as any)("link_supervisee_by_email", {
      _email: target,
    });
    setLinking(false);
    if (error) {
      toast.error(error.message || "Não foi possível vincular");
      return;
    }
    setEmail("");
    toast.success("Supervisionando vinculado");
    load();
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const { error } = await (supabase.rpc as any)("unlink_supervisee", {
      _supervisee_id: id,
    });
    setRemovingId(null);
    if (error) {
      toast.error("Erro ao remover vínculo");
      return;
    }
    toast.success("Vínculo removido");
    setSupervisees((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-8 animate-fade-up max-w-3xl">
      <header>
        <h1 className="font-display text-4xl font-medium">Supervisionandos</h1>
        <p className="mt-2 text-muted-foreground">
          Gerencie os profissionais que você supervisiona e veja o volume de pacientes ativos de cada um.
        </p>
      </header>

      <section className="rounded-3xl bg-card border border-border p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Convidar supervisionando</h2>
            <p className="text-xs text-muted-foreground">
              O profissional já deve ter conta criada e perfil definido como Supervisionando.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite_email">Email</Label>
          <div className="flex gap-2">
            <Input
              id="invite_email"
              type="email"
              placeholder="supervisionando@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <Button onClick={handleInvite} disabled={linking || !email}>
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Vincular
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-card border border-border p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Meus supervisionandos</h2>
              <p className="text-xs text-muted-foreground">
                {supervisees.length} {supervisees.length === 1 ? "vínculo ativo" : "vínculos ativos"}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : supervisees.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhum supervisionando vinculado ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {supervisees.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shrink-0">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.activePatients} {s.activePatients === 1 ? "paciente ativo" : "pacientes ativos"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleRemove(s.id)}
                  disabled={removingId === s.id}
                >
                  {removingId === s.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Supervisees;
