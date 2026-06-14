import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChildAnamnesisForm } from "@/components/app/ChildAnamnesisForm";
import { CardSkeleton } from "@/components/app/Skeletons";
import { Baby, Search, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { preserveScroll, keepScroll } from "@/lib/preserveScroll";
import { PageIntro } from "@/components/app/PageIntro";

interface Row {
  id: string;
  patient_id: string;
  child_name: string;
  chief_complaint: string;
  updated_at: string;
  created_at: string;
}

const Anamneses = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ patient_id: string; name: string } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("child_anamneses")
      .select("id,patient_id,child_name,chief_complaint,updated_at,created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) toast.error("Erro ao carregar anamneses");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.child_name.toLowerCase().includes(q));
  }, [rows, search]);

  const remove = async (id: string) => {
    if (!confirm("Excluir esta anamnese?")) return;
    const { error } = await supabase.from("child_anamneses").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Anamnese excluída");
    await preserveScroll(() => load());
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Anamneses</h1>
          <p className="text-sm text-muted-foreground mt-1">Anamneses preenchidas dos seus pacientes infantis.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar pelo nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </header>

      <PageIntro description="A anamnese organiza a história de vida, o motivo da queixa e o contexto familiar de cada paciente — base clínica para hipóteses, plano terapêutico e devolutiva à família." />


      {loading ? (
        <CardSkeleton count={3} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
          <Baby className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 font-display text-lg font-medium text-foreground/70">Nenhuma anamnese ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Abra a ficha de um paciente criança e preencha a primeira anamnese.</p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <li key={r.id}>
              <Card className="p-5 rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.child_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Atualizado em {format(new Date(r.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setEditing({ patient_id: r.patient_id, name: r.child_name })} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Excluir" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {r.chief_complaint && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                    <span className="font-medium text-foreground/70">Queixa principal: </span>{r.chief_complaint}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{editing?.name}</DialogTitle>
            <DialogDescription>Anamnese — Criança</DialogDescription>
          </DialogHeader>
          {editing && <ChildAnamnesisForm patientId={editing.patient_id} patientName={editing.name} onSaved={() => { keepScroll(); preserveScroll(() => load()); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Anamneses;
