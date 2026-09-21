import { useState } from "react";
import { Phone, Pencil, Loader2, Check, X } from "lucide-react";
import { formatWhatsAppDisplay } from "@/utils/phoneFormat";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Props = {
  phone: string | null | undefined;
  className?: string;
  /** Permite corrigir o telefone do paciente sem sair do fluxo de envio. */
  patientId?: string | null;
  /** Campo do cadastro que alimenta este número. */
  field?: "phone" | "financial_responsible_phone";
  /** Recebe o número já normalizado após salvar. */
  onPhoneUpdated?: (normalized: string) => void;
};

/**
 * Visual confirmation of the FINAL WhatsApp number that will receive
 * the message (after all normalization rules), so the psychologist can
 * verify it before sending — especially useful for landline vs mobile.
 */
export function WhatsAppNumberPreview({
  phone,
  className = "",
  patientId,
  field = "phone",
  onPhoneUpdated,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = !!patientId;

  const startEdit = () => {
    setDraft(phone ? formatWhatsAppDisplay(phone) : "");
    setEditing(true);
  };

  const save = async () => {
    if (!patientId) return;
    const normalized = normalizePhoneForWhatsApp(draft);
    if (!normalized) {
      toast.error("Informe um número válido com DDD.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("patients")
      .update({ [field]: draft.trim() })
      .eq("id", patientId);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar o telefone.");
      return;
    }
    toast.success("Telefone atualizado");
    setEditing(false);
    onPhoneUpdated?.(normalized);
  };

  if (editing) {
    return (
      <div className={`rounded-xl border border-border bg-secondary/30 p-3 space-y-2 ${className}`}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {field === "financial_responsible_phone" ? "Telefone do responsável" : "Telefone do paciente"}
        </p>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="(43) 99999-9999"
          inputMode="tel"
          autoFocus
        />
        {draft.trim() && (
          <p className="text-[11px] text-muted-foreground">
            Vai enviar para {formatWhatsAppDisplay(normalizePhoneForWhatsApp(draft) ?? "") || "—"}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" className="h-9 flex-1 gap-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setEditing(false)} disabled={saving}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (!phone) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
        <p className="text-xs uppercase tracking-wide text-amber-700">Enviar para</p>
        <p className="text-sm font-medium text-amber-800">Sem telefone cadastrado — a mensagem será copiada.</p>
        {canEdit && (
          <Button size="sm" variant="outline" className="mt-2 h-9 gap-1.5" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" /> Adicionar telefone
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20">
        <Phone className="h-4 w-4 text-[#1fb857]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Enviar para (WhatsApp)</p>
        <p className="truncate text-sm font-semibold text-foreground">{formatWhatsAppDisplay(phone)}</p>
        <p className="truncate text-[11px] text-muted-foreground">wa.me/{phone}</p>
      </div>
      {canEdit && (
        <Button size="sm" variant="ghost" className="h-9 shrink-0 gap-1.5 px-2" onClick={startEdit}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      )}
    </div>
  );
}
