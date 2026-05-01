import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, User, Phone, Mail, Loader2, MoreHorizontal, Trash2, Pencil, Eye, ClipboardList } from "lucide-react";
import { TccRecords } from "@/components/app/TccRecords";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  session_price: z.string().optional(),
});

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  session_price: number | null;
  shared_with_supervisor: boolean;
}

const Patients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [tccPatient, setTccPatient] = useState<Patient | null>(null);

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", notes: "", session_price: "" });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("user_id", user.id)
      .order("full_name");
    if (error) toast.error("Erro ao carregar pacientes");
    setPatients(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({ full_name: "", email: "", phone: "", notes: "", session_price: "" });
    setOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      notes: p.notes ?? "",
      session_price: p.session_price?.toString() ?? "",
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = patientSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      session_price: parsed.data.session_price ? Number(parsed.data.session_price) : null,
    };

    const { error } = editing
      ? await supabase.from("patients").update(payload).eq("id", editing.id)
      : await supabase.from("patients").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar paciente");
      return;
    }
    toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado");
    setOpen(false);
    load();
  };

  const handleDelete = async (p: Patient) => {
    if (!confirm(`Excluir ${p.full_name}? As sessões vinculadas também serão removidas.`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", p.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Paciente excluído");
    load();
  };

  const toggleActive = async (p: Patient) => {
    const { error } = await supabase.from("patients").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error("Erro ao atualizar");
    load();
  };

  const toggleSharing = async (p: Patient) => {
    const { error } = await supabase
      .from("patients")
      .update({ shared_with_supervisor: !p.shared_with_supervisor } as any)
      .eq("id", p.id);
    if (error) return toast.error("Erro ao atualizar compartilhamento");
    setPatients((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, shared_with_supervisor: !x.shared_with_supervisor } : x))
    );
  };

  const activeCount = patients.filter((p) => p.is_active).length;
  const inactiveCount = patients.length - activeCount;

  const filtered = patients
    .filter((p) =>
      statusFilter === "all" ? true : statusFilter === "active" ? p.is_active : !p.is_active
    )
    .filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-medium">Pacientes</h1>
          <p className="mt-2 text-muted-foreground">Gerencie quem está sob seus cuidados.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{editing ? "Editar paciente" : "Novo paciente"}</DialogTitle>
              <DialogDescription>Cadastre as informações do paciente.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Valor da sessão (R$)</Label>
                <Input id="price" type="number" step="0.01" min="0" value={form.session_price} onChange={(e) => setForm({ ...form, session_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar paciente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Ativos ({activeCount})</TabsTrigger>
            <TabsTrigger value="inactive">Inativos ({inactiveCount})</TabsTrigger>
            <TabsTrigger value="all">Todos ({patients.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <User className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">{patients.length === 0 ? "Nenhum paciente ainda." : "Nenhum paciente encontrado."}</p>
          {patients.length === 0 && (
            <Button variant="accent" className="mt-4" onClick={openNew}>
              <Plus className="h-4 w-4" /> Cadastrar primeiro paciente
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <li key={p.id} className="rounded-2xl bg-card border border-border p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground font-display text-base">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.is_active ? <span className="text-primary-glow">● Ativo</span> : <span>○ Inativo</span>}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTccPatient(p)}><ClipboardList className="h-4 w-4" /> Prontuário TCC</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(p)}>
                      {p.is_active ? "Marcar inativo" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(p)} className="text-destructive">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                {p.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {p.email}</p>}
                {p.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone}</p>}
                {p.session_price != null && <p className="text-foreground font-medium">R$ {Number(p.session_price).toFixed(2).replace(".", ",")} <span className="text-muted-foreground font-normal">/ sessão</span></p>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  Visível ao supervisor
                </div>
                <Switch
                  checked={p.shared_with_supervisor}
                  onCheckedChange={() => toggleSharing(p)}
                  aria-label="Compartilhar com supervisor"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* TCC Record Dialog */}
      <Dialog open={!!tccPatient} onOpenChange={(o) => !o && setTccPatient(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{tccPatient?.full_name}</DialogTitle>
            <DialogDescription>Prontuário TCC — Registro de Pensamento</DialogDescription>
          </DialogHeader>
          {tccPatient && <TccRecords patientId={tccPatient.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Patients;
