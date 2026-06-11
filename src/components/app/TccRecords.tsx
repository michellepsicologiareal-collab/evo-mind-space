import { useEffect, useState } from "react";
import { logClinicalAccess } from "@/utils/auditLog";
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

const G = "#B8860B";
const G_BG = "#FDF6E3";
const G_BORDER = "#E8C97A";
const INK = "#1A1A2E";
const MUTED = "#6B7280";

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
    if (data?.length) logClinicalAccess("tcc_record", data[0].id, patientId);
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
    if (error) return toast.error("Erro ao salvar RPD");
    toast.success("RPD salvo");
    setOpen(false);
    setForm({ situation: "", automatic_thought: "", emotion: "", behavior: "", cognitive_distortion: "", rational_response: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("tcc_records").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("RPD excluído");
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
    <section
      className="bg-white rounded-[10px] p-4 sm:p-6 space-y-4"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}
    >
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>
            TCC · Registro de Pensamentos Disfuncionais
          </p>
          <h2 className="font-display flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: INK }}>
            <ClipboardList className="h-4 w-4" style={{ color: G }} />
            RPD — Registro de Pensamentos Disfuncionais
          </h2>
          <p style={{ fontSize: 12, color: MUTED }}>Situação · Pensamento automático · Emoção · Comportamento · Distorção · Resposta racional</p>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full sm:w-auto shrink-0"
            style={{ background: G, color: "#fff", fontWeight: 600 }}
          >
            <Plus className="h-4 w-4" /> Novo RPD
          </Button>
        )}
      </header>

      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{ background: G_BG, color: G, border: `1px solid ${G_BORDER}`, fontSize: 11, fontWeight: 600 }}
        >
          {records.length} {records.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: G }} />
        </div>
      ) : records.length === 0 ? (
        <div
          className="rounded-lg p-6 text-center"
          style={{ background: G_BG, border: `1px dashed ${G_BORDER}` }}
        >
          <p style={{ fontSize: 13, color: MUTED }}>
            Nenhum RPD registrado ainda. Comece criando o primeiro registro de pensamento disfuncional.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const isOpen = expanded === r.id;
            const preview = r.situation || r.automatic_thought || "RPD";
            return (
              <li key={r.id} className="rounded-lg border bg-background overflow-hidden" style={{ borderColor: "#EEE7D6" }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left text-sm hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate" style={{ color: INK }}>{preview}</p>
                    <p className="text-xs" style={{ color: MUTED }}>
                      {format(new Date(r.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2.5 border-t pt-3 text-sm" style={{ borderColor: "#F0E9D8" }}>
                    {fields.map(({ key, label }) => {
                      const val = r[key as keyof TccRecord];
                      if (!val) return null;
                      return (
                        <div key={key}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: G }}>{label}</p>
                          <p className="whitespace-pre-wrap" style={{ color: INK }}>{val as string}</p>
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
            <DialogTitle className="font-display text-xl">Novo RPD</DialogTitle>
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
            <Button onClick={handleSave} disabled={saving} style={{ background: G, color: "#fff", fontWeight: 600 }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
