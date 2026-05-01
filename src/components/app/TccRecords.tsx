import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Loader2, Trash2, ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TccRecord {
  id: string;
  situation: string | null;
  automatic_thought: string | null;
  emotion: string | null;
  behavior: string | null;
  cognitive_distortion: string | null;
  rational_response: string | null;
  created_at: string;
}

interface Props {
  patientId: string;
  readOnly?: boolean;
}

export const TccRecords = ({ patientId, readOnly = false }: Props) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<TccRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    situation: "",
    automatic_thought: "",
    emotion: "",
    behavior: "",
    cognitive_distortion: "",
    rational_response: "",
  });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("tcc_records")
      .select("id, situation, automatic_thought, emotion, behavior, cognitive_distortion, rational_response, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(20);
    setRecords(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [patientId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any).from("tcc_records").insert({
      user_id: user.id,
      patient_id: patientId,
      situation: form.situation || null,
      automatic_thought: form.automatic_thought || null,
      emotion: form.emotion || null,
      behavior: form.behavior || null,
      cognitive_distortion: form.cognitive_distortion || null,
      rational_response: form.rational_response || null,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar registro TCC");
    toast.success("Registro TCC salvo");
    setOpen(false);
    setForm({ situation: "", automatic_thought: "", emotion: "", behavior: "", cognitive_distortion: "", rational_response: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("tcc_records").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Registro excluído");
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: "situation", label: "Situação / Queixa" },
    { key: "automatic_thought", label: "Pensamento Automático" },
    { key: "emotion", label: "Emoção" },
    { key: "behavior", label: "Comportamento" },
    { key: "cognitive_distortion", label: "Distorção Cognitiva" },
    { key: "rational_response", label: "Resposta Racional" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Prontuário TCC
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo registro
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-4 text-center">
          <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg bg-secondary/40 p-3 text-center">
          Nenhum registro TCC ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const isOpen = expanded === r.id;
            const preview = r.situation || r.automatic_thought || "Registro TCC";
            return (
              <li key={r.id} className="rounded-lg bg-secondary/40 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{preview}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2 text-sm">
                    {fields.map(({ key, label }) => {
                      const val = r[key as keyof TccRecord];
                      if (!val) return null;
                      return (
                        <div key={key}>
                          <p className="text-xs font-medium text-muted-foreground">{label}</p>
                          <p className="whitespace-pre-wrap">{val as string}</p>
                        </div>
                      );
                    })}
                    {!readOnly && (
                      <div className="flex justify-end pt-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Novo Registro TCC</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {fields.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-sm">{label}</Label>
                <Textarea
                  rows={2}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={`Descreva ${label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
