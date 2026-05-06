import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Plus,
  Trash2,
  Share2,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SupervisionRecord {
  id: string;
  supervision_date: string;
  patient_name: string;
  chief_complaint: string;
  problem_list: string;
  identified_beliefs: string;
  planned_interventions: string;
  general_observations: string;
  shared_fields: string[];
  shared_at: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  patient_name: "Nome do paciente",
  chief_complaint: "Queixa principal",
  problem_list: "Lista de problemas",
  identified_beliefs: "Crenças identificadas",
  planned_interventions: "Intervenções planejadas",
  general_observations: "Observações gerais",
};

const SHAREABLE_FIELDS = Object.keys(FIELD_LABELS);

const emptyForm = {
  supervision_date: new Date().toISOString().split("T")[0],
  patient_name: "",
  chief_complaint: "",
  problem_list: "",
  identified_beliefs: "",
  planned_interventions: "",
  general_observations: "",
};

interface Props {
  supervisorId: string;
  superviseeId: string;
  superviseeName: string;
}

export function SupervisionRecords({ supervisorId, superviseeId, superviseeName }: Props) {
  const [records, setRecords] = useState<SupervisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Share modal
  const [shareTarget, setShareTarget] = useState<SupervisionRecord | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("supervision_records")
      .select("*")
      .eq("supervisor_id", supervisorId)
      .eq("supervisee_id", superviseeId)
      .order("supervision_date", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar registros");
    }
    setRecords((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supervisorId, superviseeId]);

  const handleSave = async () => {
    if (!form.patient_name.trim()) {
      toast.error("Informe o nome do paciente");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("supervision_records").insert({
      supervisor_id: supervisorId,
      supervisee_id: superviseeId,
      supervision_date: form.supervision_date,
      patient_name: form.patient_name.trim(),
      chief_complaint: form.chief_complaint.trim(),
      problem_list: form.problem_list.trim(),
      identified_beliefs: form.identified_beliefs.trim(),
      planned_interventions: form.planned_interventions.trim(),
      general_observations: form.general_observations.trim(),
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar registro");
      return;
    }
    toast.success("Registro salvo");
    setForm(emptyForm);
    setFormOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("supervision_records").delete().eq("id", id);
    toast.success("Registro excluído");
    load();
  };

  const openShare = (record: SupervisionRecord) => {
    setShareTarget(record);
    setSelectedFields(record.shared_fields?.length ? [...record.shared_fields] : [...SHAREABLE_FIELDS]);
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const confirmShare = async () => {
    if (!shareTarget || selectedFields.length === 0) {
      toast.error("Selecione pelo menos um campo");
      return;
    }
    setSharing(true);
    const { error } = await supabase
      .from("supervision_records")
      .update({
        shared_fields: selectedFields,
        shared_at: new Date().toISOString(),
      } as any)
      .eq("id", shareTarget.id);

    if (!error) {
      // Send notification to supervisee
      await supabase.from("notifications").insert({
        user_id: superviseeId,
        title: "Registro de Supervisão Compartilhado",
        message: `Seu supervisor compartilhou um registro de supervisão sobre "${shareTarget.patient_name}" (${format(new Date(shareTarget.supervision_date + "T12:00:00"), "dd/MM/yyyy")}).`,
        type: "general",
      } as any);
      toast.success("Registro compartilhado com o supervisionando");
      load();
    } else {
      toast.error("Erro ao compartilhar");
    }
    setSharing(false);
    setShareTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Registros de Supervisão</h3>
          <span className="text-xs text-muted-foreground">({records.length})</span>
        </div>
        <Button variant="accent" size="sm" onClick={() => { setForm(emptyForm); setFormOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo Registro
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum registro de supervisão ainda. Crie o primeiro acima ✨
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const isExpanded = expandedRecord === r.id;
            return (
              <li key={r.id} className="rounded-xl bg-card border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setExpandedRecord(isExpanded ? null : r.id)}
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {r.patient_name || "Sem paciente"} — {format(new Date(r.supervision_date + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.chief_complaint || "Sem queixa registrada"}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.shared_fields?.length > 0 && (
                      <span className="text-[10px] bg-lilac/20 text-lilac-foreground px-2 py-0.5 rounded-full font-medium">
                        Compartilhado
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openShare(r)}>
                      <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-2 border-t border-border/60 space-y-2 text-sm">
                    {r.chief_complaint && (
                      <div><span className="font-medium text-foreground">Queixa principal:</span> <span className="text-muted-foreground">{r.chief_complaint}</span></div>
                    )}
                    {r.problem_list && (
                      <div><span className="font-medium text-foreground">Lista de problemas:</span> <span className="text-muted-foreground">{r.problem_list}</span></div>
                    )}
                    {r.identified_beliefs && (
                      <div><span className="font-medium text-foreground">Crenças identificadas:</span> <span className="text-muted-foreground">{r.identified_beliefs}</span></div>
                    )}
                    {r.planned_interventions && (
                      <div><span className="font-medium text-foreground">Intervenções planejadas:</span> <span className="text-muted-foreground">{r.planned_interventions}</span></div>
                    )}
                    {r.general_observations && (
                      <div><span className="font-medium text-foreground">Observações gerais:</span> <span className="text-muted-foreground">{r.general_observations}</span></div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* New record form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              Novo Registro de Supervisão
            </DialogTitle>
            <DialogDescription>
              Registro para {superviseeName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Data da supervisão</Label>
              <Input
                type="date"
                value={form.supervision_date}
                onChange={(e) => setForm({ ...form, supervision_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Nome do paciente discutido</Label>
              <Input
                placeholder="Nome do paciente"
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Queixa principal</Label>
              <Textarea
                placeholder="Queixa principal do paciente..."
                rows={2}
                value={form.chief_complaint}
                onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
              />
            </div>
            <div>
              <Label>Lista de problemas</Label>
              <Textarea
                placeholder="Problemas identificados..."
                rows={2}
                value={form.problem_list}
                onChange={(e) => setForm({ ...form, problem_list: e.target.value })}
              />
            </div>
            <div>
              <Label>Crenças identificadas</Label>
              <Textarea
                placeholder="Crenças nucleares e intermediárias..."
                rows={2}
                value={form.identified_beliefs}
                onChange={(e) => setForm({ ...form, identified_beliefs: e.target.value })}
              />
            </div>
            <div>
              <Label>Intervenções planejadas</Label>
              <Textarea
                placeholder="Intervenções e técnicas planejadas..."
                rows={2}
                value={form.planned_interventions}
                onChange={(e) => setForm({ ...form, planned_interventions: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações gerais</Label>
              <Textarea
                placeholder="Observações adicionais..."
                rows={2}
                value={form.general_observations}
                onChange={(e) => setForm({ ...form, general_observations: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="accent" onClick={handleSave} disabled={saving || !form.patient_name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Salvar Registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share modal */}
      <Dialog open={!!shareTarget} onOpenChange={(o) => !o && setShareTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Share2 className="h-5 w-5 text-accent" />
              Compartilhar com supervisionando
            </DialogTitle>
            <DialogDescription>
              Selecione quais campos do registro serão visíveis para {superviseeName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {SHAREABLE_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer rounded-lg p-2 hover:bg-secondary/40 transition-colors">
                <Checkbox
                  checked={selectedFields.includes(field)}
                  onCheckedChange={() => toggleField(field)}
                />
                <span className="text-sm font-medium">{FIELD_LABELS[field]}</span>
                {shareTarget && (shareTarget as any)[field] && (
                  <span className="text-xs text-muted-foreground truncate flex-1 text-right">
                    {String((shareTarget as any)[field]).substring(0, 40)}...
                  </span>
                )}
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareTarget(null)}>Cancelar</Button>
            <Button variant="accent" onClick={confirmShare} disabled={sharing || selectedFields.length === 0}>
              {sharing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
              Compartilhar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
