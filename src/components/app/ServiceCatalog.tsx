import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Service {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export const ServiceCatalog = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", price: "" });

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("services")
      .select("id, name, price, is_active")
      .eq("user_id", user.id)
      .order("name");
    setServices(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", price: "" });
    setOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, price: String(s.price) });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) return toast.error("Informe o nome do serviço");
    const price = Number(form.price) || 0;
    setSaving(true);

    const { error } = editing
      ? await (supabase as any).from("services").update({ name, price }).eq("id", editing.id)
      : await (supabase as any).from("services").insert({ user_id: user.id, name, price });

    setSaving(false);
    if (error) return toast.error("Erro ao salvar serviço");
    toast.success(editing ? "Serviço atualizado" : "Serviço criado");
    setOpen(false);
    load();
  };

  const handleDelete = async (s: Service) => {
    if (!confirm(`Excluir "${s.name}"?`)) return;
    const { error } = await (supabase as any).from("services").delete().eq("id", s.id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Serviço excluído");
    load();
  };

  const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

  return (
    <section className="rounded-3xl bg-card border border-border p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Catálogo de Serviços</h2>
            <p className="text-xs text-muted-foreground">
              Defina os tipos de atendimento e seus valores.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        </div>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum serviço cadastrado. Crie seu primeiro serviço acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{s.name}</p>
                <p className="text-sm text-muted-foreground">{formatBRL(Number(s.price))}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? "Editar serviço" : "Novo serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do serviço</Label>
              <Input
                placeholder="Ex.: Avaliação Neuropsicológica"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
