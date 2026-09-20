import { Phone } from "lucide-react";
import { formatWhatsAppDisplay } from "@/utils/phoneFormat";

/**
 * Visual confirmation of the FINAL WhatsApp number that will receive
 * the message (after all normalization rules), so the psychologist can
 * verify it before sending — especially useful for landline vs mobile.
 */
export function WhatsAppNumberPreview({ phone, className = "" }: { phone: string | null | undefined; className?: string }) {
  if (!phone) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
        <p className="text-xs uppercase tracking-wide text-amber-700">Enviar para</p>
        <p className="text-sm font-medium text-amber-800">Sem telefone cadastrado — a mensagem será copiada.</p>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20">
        <Phone className="h-4 w-4 text-[#1fb857]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Enviar para (WhatsApp)</p>
        <p className="truncate text-sm font-semibold text-foreground">{formatWhatsAppDisplay(phone)}</p>
        <p className="truncate text-[11px] text-muted-foreground">wa.me/{phone}</p>
      </div>
    </div>
  );
}
