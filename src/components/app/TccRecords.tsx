import { useEffect, useState } from "react";
import { logClinicalAccess } from "@/utils/auditLog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Loader2, Trash2, ClipboardList, ChevronDown, ChevronRight, Link2, Copy, MessageCircle, User, Ban } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { preserveScroll, keepScroll } from "@/lib/preserveScroll";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  filled_by?: string | null;
  created_at: string;
}

interface RpdInvite {
  id: string;
  token: string;
  password: string | null;
  expires_at: string;
  revoked_at: string | null;
  submissions_count: number;
  created_at: string;
}

interface Props {
  patientId: string;
  readOnly?: boolean;
}


const G = "hsl(var(--gold))";
const G_BG = "hsl(var(--gold) / 0.15)";
const G_BORDER = "hsl(var(--gold) / 0.5)";
const INK = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";

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

  // Link público para o paciente preencher
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkDays, setLinkDays] = useState("30");
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState<{ full_name: string; phone: string | null } | null>(null);
  const [invites, setInvites] = useState<RpdInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("tcc_records")
      .select("id, situation, automatic_thought, emotion, behavior, cognitive_distortion, rational_response, filled_by, created_at")
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

  const loadInvites = async () => {
    setInvitesLoading(true);
    const { data } = await (supabase as any)
      .from("rpd_invites")
      .select("id, token, password, expires_at, revoked_at, submissions_count, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(10);
    setInvites(data ?? []);
    setInvitesLoading(false);
  };

  const openLinkDialog = async () => {
    setLinkOpen(true);
    setPublicLink(null);
    setLinkPassword("");
    setLinkDays("30");
    loadInvites();
    const { data } = await (supabase as any)
      .from("patients")
      .select("full_name, phone")
      .eq("id", patientId)
      .maybeSingle();
    setPatientInfo(data ?? null);
  };

  const generateLink = async () => {
    if (!user) return;
    setLinkLoading(true);
    const days = Number(linkDays) || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await (supabase as any)
      .from("rpd_invites")
      .insert({
        user_id: user.id,
        patient_id: patientId,
        password: linkPassword.trim() || null,
        expires_at: expiresAt,
      })
      .select("token")
      .single();
    setLinkLoading(false);
    if (error || !data?.token) {
      toast.error("Não foi possível gerar o link.");
      return;
    }
    setPublicLink(`${window.location.origin}/rpd/${data.token}`);
    toast.success(`Link gerado · válido por ${days} dias`);
    loadInvites();
  };

  const revokeInvite = async (id: string, token: string) => {
    setRevoking(id);
    const { error } = await (supabase as any)
      .from("rpd_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    setRevoking(null);
    if (error) return toast.error("Não foi possível revogar o link.");
    toast.success("Acesso revogado");
    if (publicLink?.endsWith(token)) setPublicLink(null);
    loadInvites();
  };


  const copyLink = async () => {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    toast.success("Link copiado");
  };

  const sendWhatsApp = () => {
    if (!publicLink) return;
    const phone = normalizePhoneForWhatsApp(patientInfo?.phone);
    const msg = `Olá! Use este link para registrar seus pensamentos (RPD) durante a semana: ${publicLink}${linkPassword.trim() ? `\n\nSenha: ${linkPassword.trim()}` : ""}`;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
  };


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
    keepScroll();
    setOpen(false);
    setForm({ situation: "", automatic_thought: "", emotion: "", behavior: "", cognitive_distortion: "", rational_response: "" });
    await preserveScroll(() => load());
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={openLinkDialog}
              className="w-full sm:w-auto"
              style={{ borderColor: G_BORDER, color: G, fontWeight: 600 }}
            >
              <Link2 className="h-4 w-4" /> Enviar link ao paciente
            </Button>
            <Button
              size="sm"
              onClick={() => setOpen(true)}
              className="w-full sm:w-auto"
              style={{ background: G, color: "#fff", fontWeight: 600 }}
            >
              <Plus className="h-4 w-4" /> Novo RPD
            </Button>
          </div>
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
              <li key={r.id} className="rounded-lg border bg-background overflow-hidden" style={{ borderColor: "hsl(var(--gold) / 0.15)" }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left text-sm hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate" style={{ color: INK }}>{preview}</p>
                    <p className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: MUTED }}>
                      {format(new Date(r.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      {r.filled_by === "patient" && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                          style={{ background: G_BG, color: G, border: `1px solid ${G_BORDER}`, fontSize: 10, fontWeight: 600 }}
                        >
                          <User className="h-3 w-3" /> Preenchido pelo paciente
                        </span>
                      )}
                    </p>
                  </div>

                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2.5 border-t pt-3 text-sm" style={{ borderColor: "hsl(var(--gold) / 0.15)" }}>
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
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
          style={{ background: "hsl(var(--muted))" }}
        >
          {/* Header padronizado (mesmo estilo das formulações TE/ACT) */}
          <div
            className="bg-white rounded-t-lg p-5 sm:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}
          >
            <DialogHeader className="space-y-1 text-left">
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>
                TCC · Registro de Pensamentos Disfuncionais
              </p>
              <DialogTitle className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: INK }}>
                Novo RPD
              </DialogTitle>
              <p style={{ fontSize: 13, color: MUTED }}>
                Preencha os 6 campos do modelo cognitivo: situação, pensamento, emoção, comportamento, distorção e resposta racional.
              </p>
              <div className="pt-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                  style={{ background: G_BG, color: G, border: `1px solid ${G_BORDER}`, fontSize: 11, fontWeight: 600 }}
                >
                  RPD · 6 colunas
                </span>
              </div>
            </DialogHeader>
          </div>

          {/* Corpo em cards padronizados */}
          <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
            {fields.map(({ key, label }, idx) => (
              <section
                key={key}
                className="bg-white rounded-[10px] p-4 sm:p-5 space-y-2"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}
              >
                <header className="space-y-0.5">
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>
                    Coluna {idx + 1}
                  </p>
                  <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: INK }}>
                    {label}
                  </h3>
                </header>
                <Textarea
                  rows={3}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={`Descreva ${label.toLowerCase()}...`}
                  className="resize-y"
                />
              </section>
            ))}
          </div>

          <DialogFooter
            className="p-4 sm:p-5 bg-white rounded-b-lg gap-2 sm:gap-2 flex-col-reverse sm:flex-row"
            style={{ boxShadow: "0 -1px 4px rgba(0,0,0,0.04)" }}
          >
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto"
              style={{ background: G, color: "#fff", fontWeight: 600 }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar RPD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2" style={{ color: INK }}>
              <Link2 className="h-5 w-5" style={{ color: G }} /> Link do RPD para o paciente
            </DialogTitle>
            <DialogDescription>
              {patientInfo?.full_name ? `${patientInfo.full_name} ` : ""}poderá preencher o RPD pelo link. Cada envio aparece aqui automaticamente.
            </DialogDescription>
          </DialogHeader>

          {!publicLink ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Validade do link</Label>
                <Select value={linkDays} onValueChange={setLinkDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Depois desse prazo o link deixa de funcionar automaticamente.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Senha (opcional)</Label>
                <Input
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="Ex.: 1234"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">Se preencher, o paciente precisará digitar esta senha para abrir o link.</p>
              </div>
              <Button
                onClick={generateLink}
                disabled={linkLoading}
                className="w-full"
                style={{ background: G, color: "#fff", fontWeight: 600 }}
              >
                {linkLoading && <Loader2 className="h-4 w-4 animate-spin" />} Gerar link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs break-all rounded-lg p-3" style={{ background: G_BG, border: `1px solid ${G_BORDER}`, color: INK }}>
                {publicLink}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={copyLink} className="w-full sm:flex-1">
                  <Copy className="h-4 w-4" /> Copiar link
                </Button>
                <Button
                  onClick={sendWhatsApp}
                  className="w-full sm:flex-1"
                  style={{ background: "hsl(var(--moss))", color: "#fff", fontWeight: 600 }}
                >
                  <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O link vale por {linkDays} dias e aceita vários preenchimentos. Você pode revogar o acesso a qualquer momento abaixo.
              </p>
            </div>
          )}

          {/* Links gerados */}
          <div className="space-y-2 border-t pt-3" style={{ borderColor: "hsl(var(--gold) / 0.15)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: G }}>Links gerados</p>
            {invitesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: G }} />
            ) : invites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum link gerado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {invites.map((inv) => {
                  const expired = new Date(inv.expires_at) <= new Date();
                  const revoked = !!inv.revoked_at;
                  const active = !expired && !revoked;
                  return (
                    <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5" style={{ borderColor: "hsl(var(--gold) / 0.15)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium" style={{ color: INK }}>
                          {revoked ? "Revogado" : expired ? "Expirado" : `Válido até ${format(new Date(inv.expires_at), "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                        <p className="text-[11px]" style={{ color: MUTED }}>
                          Criado em {format(new Date(inv.created_at), "dd/MM/yyyy", { locale: ptBR })} · {inv.submissions_count} envio{inv.submissions_count === 1 ? "" : "s"}
                          {inv.password ? " · com senha" : ""}
                        </p>
                      </div>
                      {active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive shrink-0"
                          disabled={revoking === inv.id}
                          onClick={() => revokeInvite(inv.id, inv.token)}
                        >
                          {revoking === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Revogar
                        </Button>
                      ) : (
                        <span className="text-[11px] shrink-0" style={{ color: MUTED }}>inativo</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>


          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLinkOpen(false); preserveScroll(() => load()); }} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>

  );
};
