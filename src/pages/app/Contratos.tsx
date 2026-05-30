import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileCheck, Search, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface SignedContract {
  id: string;
  patient_name: string;
  patient_cpf: string;
  patient_whatsapp: string;
  patient_birth_date: string | null;
  patient_address: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  clause_responses: Record<string, unknown>;
  accepted_lgpd: boolean;
  accepted_at: string;
  ip_address: string | null;
}

export default function Contratos() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<SignedContract[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SignedContract | null>(null);

  const fetchContracts = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("signed_contracts")
      .select("*")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false });
    setContracts((data as SignedContract[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("signed_contracts").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir contrato");
    } else {
      toast.success("Contrato excluído");
      setContracts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const filtered = contracts.filter((c) =>
    c.patient_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Contratos Assinados</h1>
        <p className="text-muted-foreground text-sm">
          {contracts.length} contrato{contracts.length !== 1 ? "s" : ""} aceito{contracts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>Nenhum contrato assinado encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display font-semibold">{c.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.accepted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-lilac/20 text-lilac-dark">
                    Aceito
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">CPF: {c.patient_cpf || "—"}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelected(c)}>
                    <Eye className="h-4 w-4 mr-1" /> Ver
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O contrato de {c.patient_name} será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(c.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Contrato — {selected?.patient_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">WhatsApp</p>
                  <p>{selected.patient_whatsapp || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data de nascimento</p>
                  <p>
                    {selected.patient_birth_date
                      ? format(new Date(selected.patient_birth_date), "dd/MM/yyyy")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">CPF</p>
                  <p>{selected.patient_cpf || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Endereço</p>
                  <p>{selected.patient_address || "—"}</p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="font-semibold mb-2">Contato de Emergência</p>
                <p>{selected.emergency_contact_name} ({selected.emergency_contact_relationship})</p>
                <p>{selected.emergency_contact_phone}</p>
              </div>

              <div className="border-t pt-3">
                <p className="font-semibold mb-2">Respostas às Cláusulas</p>
                {Object.entries(selected.clause_responses).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-muted-foreground">LGPD aceita</span>
                <Badge variant={selected.accepted_lgpd ? "default" : "destructive"}>
                  {selected.accepted_lgpd ? "Sim" : "Não"}
                </Badge>
              </div>

              {selected.ip_address && (
                <p className="text-xs text-muted-foreground">IP: {selected.ip_address}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
