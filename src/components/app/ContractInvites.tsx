import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  ShieldX,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractInvite {
  id: string;
  token: string;
  patient_label: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  signed_contract_id: string | null;
  created_at: string;
}

interface Props {
  templateId: string | null;
}

/**
 * Manages one-time contract signing invites. Each invite = one link that:
 *  - Expires after N days
 *  - Can only be signed once (server-side atomic check)
 *  - Can be revoked at any time by the professional
 */
export function ContractInvites({ templateId }: Props) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<ContractInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);

  const fetchInvites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contract_invites")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error(error);
    } else {
      setInvites((data as ContractInvite[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const createInvite = async () => {
    if (!user || !templateId) return;
    setCreating(true);
    const expiresAt = new Date(
      Date.now() + Math.max(1, expiresInDays) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase.from("contract_invites").insert({
      user_id: user.id,
      template_id: templateId,
      patient_label: label.trim() || null,
      expires_at: expiresAt,
    });
    setCreating(false);
    if (error) {
      toast.error("Erro ao gerar link");
      console.error(error);
      return;
    }
    setLabel("");
    toast.success("Link gerado. Envie ao paciente.");
    void fetchInvites();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("contract_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao revogar link");
      return;
    }
    toast.success("Link revogado");
    void fetchInvites();
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("contract_invites")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir link");
      return;
    }
    void fetchInvites();
  };

  const linkFor = (token: string) =>
    `${window.location.origin}/contrato/${token}`;

  const copyLink = (token: string) => {
    void navigator.clipboard.writeText(linkFor(token));
    toast.success("Link copiado");
  };

  const statusOf = (
    inv: ContractInvite,
  ): { label: string; tone: "active" | "used" | "revoked" | "expired" } => {
    if (inv.revoked_at) return { label: "Revogado", tone: "revoked" };
    if (inv.used_at) return { label: "Assinado", tone: "used" };
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return { label: "Expirado", tone: "expired" };
    }
    return { label: "Ativo", tone: "active" };
  };

  if (!templateId) return null;

  return (
    <div className="space-y-4">
      {/* Create */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-4">
        <div className="flex items-center gap-2 text-accent">
          <Link2 className="h-5 w-5" />
          <p className="font-display font-semibold">
            Gerar link individual para paciente
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada link vale para <strong>uma única assinatura</strong> e expira
          automaticamente. Assim que o paciente assinar, o link deixa de
          funcionar. Você pode revogar a qualquer momento.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <div>
            <Label className="text-xs">Identificação (opcional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Ana Silva"
              maxLength={100}
            />
          </div>
          <div>
            <Label className="text-xs">Válido por (dias)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value) || 30)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="accent"
              onClick={createInvite}
              disabled={creating}
              className="w-full"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Gerar link
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Links gerados
          </h3>
          <span className="text-xs text-muted-foreground">
            {invites.length} no total
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum link gerado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => {
              const status = statusOf(inv);
              const isActive = status.tone === "active";
              return (
                <div
                  key={inv.id}
                  className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {inv.patient_label || "Sem identificação"}
                      </p>
                      <Badge
                        variant={
                          status.tone === "active"
                            ? "default"
                            : status.tone === "used"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          status.tone === "used"
                            ? "bg-lilac/20 text-lilac-dark"
                            : status.tone === "revoked" ||
                                status.tone === "expired"
                            ? "text-muted-foreground"
                            : ""
                        }
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado{" "}
                      {format(new Date(inv.created_at), "dd/MM/yy HH:mm", {
                        locale: ptBR,
                      })}
                      {" • Expira "}
                      {format(new Date(inv.expires_at), "dd/MM/yy", {
                        locale: ptBR,
                      })}
                      {inv.used_at &&
                        ` • Assinado ${format(
                          new Date(inv.used_at),
                          "dd/MM/yy HH:mm",
                          { locale: ptBR },
                        )}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isActive && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(inv.token)}
                        >
                          <Copy className="h-4 w-4 mr-1" /> Copiar
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={linkFor(inv.token)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => revoke(inv.id)}
                          title="Revogar link"
                        >
                          <ShieldX className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {!isActive && !inv.signed_contract_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => remove(inv.id)}
                      >
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
