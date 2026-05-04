import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Upload, User, Users, ShieldCheck, X, Building2, Trash2, FileText, Download, DatabaseBackup, UploadCloud } from "lucide-react";
import { ServiceCatalog } from "@/components/app/ServiceCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  clinic_name: z.string().trim().max(120).optional().or(z.literal("")),
  crp: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  specialty: z.string().trim().max(120).optional().or(z.literal("")),
  pix_key: z.string().trim().max(255).optional().or(z.literal("")),
});

type ProfileType = "standard" | "supervisee" | "supervisor";

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkingSupervisor, setLinkingSupervisor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ full_name: "", clinic_name: "", crp: "", phone: "", specialty: "", pix_key: "" });
  const [profileType, setProfileType] = useState<ProfileType>("standard");
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wiping, setWiping] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);

  const fetchMyData = async () => {
    if (!user) return null;
    const [pRes, sRes, prRes] = await Promise.all([
      supabase.from("patients").select("*").eq("user_id", user.id).order("full_name"),
      supabase.from("sessions").select("*").eq("user_id", user.id).order("scheduled_at", { ascending: false }),
      (supabase as any).from("patient_progress").select("*").eq("user_id", user.id).order("recorded_at", { ascending: false }),
    ]);
    // Build patient name map for display
    const patientMap = new Map((pRes.data ?? []).map((p: any) => [p.id, p.full_name]));
    const addName = (row: any) => ({ ...row, _patient_name: patientMap.get(row.patient_id) ?? "—" });
    return { patients: pRes.data ?? [], sessions: (sRes.data ?? []).map(addName), progress: (prRes.data ?? []).map(addName) };
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const data = await fetchMyData();
      if (!data) return;
      const esc = (v: any) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return `"${s}"`;
      };
      let csv = "--- PACIENTES ---\nNome,Email,Telefone,Nascimento,Ativo,Preço sessão,Notas\n";
      data.patients.forEach((p: any) => {
        csv += [p.full_name, p.email, p.phone, p.birth_date, p.is_active ? "Sim" : "Não", p.session_price, p.notes].map(esc).join(",") + "\n";
      });
      csv += "\n--- SESSÕES ---\nPaciente,Data,Status,Duração(min),Preço,Pagamento,Método,Notas\n";
      data.sessions.forEach((s: any) => {
        csv += [s._patient_name, s.scheduled_at, s.status, s.duration_minutes, s.price, s.payment_status, s.payment_method, s.notes].map(esc).join(",") + "\n";
      });
      csv += "\n--- HUMOR / PROGRESSO ---\nPaciente,Data,Humor(1-10),Nota\n";
      data.progress.forEach((pr: any) => {
        csv += [pr._patient_name, pr.recorded_at, pr.mood_score, pr.note].map(esc).join(",") + "\n";
      });
      downloadFile(csv, `psireal_dados_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
      toast.success("CSV exportado!");
    } catch {
      toast.error("Erro ao exportar CSV");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const data = await fetchMyData();
      if (!data) return;
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      let y = 20;
      const lh = 6;
      const addPage = () => { doc.addPage(); y = 20; };
      const checkPage = () => { if (y > 270) addPage(); };

      doc.setFontSize(16);
      doc.text("Relatório de Dados — PsiReal", 14, y);
      y += 10;
      doc.setFontSize(10);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, y);
      y += 12;

      doc.setFontSize(13);
      doc.text("Pacientes", 14, y); y += 8;
      doc.setFontSize(9);
      data.patients.forEach((p: any) => {
        checkPage();
        doc.text(`• ${p.full_name} — ${p.is_active ? "Ativo" : "Inativo"} — ${p.email || "sem email"} — R$ ${p.session_price ?? "—"}`, 16, y);
        y += lh;
      });
      y += 6;

      checkPage();
      doc.setFontSize(13);
      doc.text("Sessões", 14, y); y += 8;
      doc.setFontSize(9);
      data.sessions.forEach((s: any) => {
        checkPage();
        const dt = new Date(s.scheduled_at).toLocaleDateString("pt-BR");
        doc.text(`• ${s._patient_name} — ${dt} — ${s.status} — R$ ${s.price ?? "—"} (${s.payment_status})`, 16, y);
        y += lh;
      });
      y += 6;

      checkPage();
      doc.setFontSize(13);
      doc.text("Humor / Progresso", 14, y); y += 8;
      doc.setFontSize(9);
      data.progress.forEach((pr: any) => {
        checkPage();
        const dt = new Date(pr.recorded_at).toLocaleDateString("pt-BR");
        doc.text(`• ${pr._patient_name} — ${dt} — Humor: ${pr.mood_score ?? "—"} — ${pr.note ?? ""}`.slice(0, 120), 16, y);
        y += lh;
      });

      doc.save(`psireal_dados_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exportado!");
    } catch {
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleBackupExport = async () => {
    setBackingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Faça login novamente"); return; }
      const res = await supabase.functions.invoke("backup-export", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      const json = JSON.stringify(res.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `psireal_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup completo baixado!");
    } catch {
      toast.error("Erro ao gerar backup");
    } finally {
      setBackingUp(false);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Selecione um arquivo .json de backup");
      return;
    }
    setPendingBackupFile(file);
    setRestoreConfirm("");
    setRestoreOpen(true);
  };

  const handleBackupRestore = async () => {
    if (!pendingBackupFile || !user) return;
    if (restoreConfirm.trim().toUpperCase() !== "RESTAURAR") {
      toast.error("Digite RESTAURAR para confirmar");
      return;
    }
    setRestoring(true);
    try {
      const text = await pendingBackupFile.text();
      const backup = JSON.parse(text);
      if (!backup.version || !backup.tables) {
        toast.error("Arquivo de backup inválido");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Faça login novamente"); return; }
      const res = await supabase.functions.invoke("backup-import", {
        body: backup,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      const results = res.data?.results;
      const totalInserted = Object.values(results || {}).reduce(
        (sum: number, r: any) => sum + (r.inserted || 0), 0
      );
      setRestoreOpen(false);
      setPendingBackupFile(null);
      toast.success(`Backup restaurado! ${totalInserted} registros importados.`);
    } catch (err: any) {
      toast.error("Erro ao restaurar backup: " + (err?.message || "tente novamente"));
    } finally {
      setRestoring(false);
    }
  };

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setForm({
        full_name: data.full_name ?? "",
        clinic_name: (data as any).clinic_name ?? "",
        crp: data.crp ?? "",
        phone: data.phone ?? "",
        specialty: data.specialty ?? "",
        pix_key: (data as any).pix_key ?? "",
      });
      setProfileType((data.profile_type as ProfileType) ?? "standard");
      setSupervisorId(data.supervisor_id ?? null);

      if (data.supervisor_id) {
        const { data: sup } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.supervisor_id)
          .maybeSingle();
        setSupervisorName(sup?.full_name ?? "Supervisor");
      } else {
        setSupervisorName(null);
      }

      if (data.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(data.avatar_url, 3600);
        setAvatarUrl(signed?.signedUrl ?? null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        clinic_name: parsed.data.clinic_name || null,
        crp: parsed.data.crp || null,
        phone: parsed.data.phone || null,
         specialty: parsed.data.specialty || null,
         pix_key: parsed.data.pix_key || null,
         profile_type: profileType,
        // If switching to standard, clear supervisor link
        ...(profileType === "standard" ? { supervisor_id: null } : {}),
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
      return;
    }
    if (profileType === "standard") {
      setSupervisorId(null);
      setSupervisorName(null);
    }
    if (parsed.data.pix_key) {
      toast.success("Perfil atualizado — chave Pix salva com sucesso! Ela será incluída automaticamente nas cobranças via WhatsApp.");
    } else {
      toast.success("Perfil atualizado");
    }
  };

  const handleLinkSupervisor = async () => {
    if (!user) return;
    const email = supervisorEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Informe o email do supervisor");
      return;
    }

    setLinkingSupervisor(true);
    // Look up the supervisor's profile id by their auth email (security definer RPC).
    const { data: lookup, error: lookupErr } = await (supabase.rpc as any)(
      "get_profile_id_by_email",
      { _email: email },
    );
    const supervisorUuid = lookup as string | null;

    if (lookupErr || !supervisorUuid) {
      setLinkingSupervisor(false);
      toast.error("Supervisor não encontrado. Confirme o email cadastrado.");
      return;
    }

    if (supervisorUuid === user.id) {
      setLinkingSupervisor(false);
      toast.error("Você não pode ser seu próprio supervisor.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ supervisor_id: supervisorUuid })
      .eq("id", user.id);
    setLinkingSupervisor(false);

    if (error) {
      toast.error("Não foi possível vincular o supervisor.");
      return;
    }
    setSupervisorEmail("");
    toast.success("Supervisor vinculado.");
    load();
  };

  const handleUnlinkSupervisor = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ supervisor_id: null })
      .eq("id", user.id);
    if (error) return toast.error("Erro ao remover supervisor");
    toast.success("Vínculo removido");
    setSupervisorId(null);
    setSupervisorName(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter até 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast.error("Erro ao enviar foto");
      return;
    }

    await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600);
    setAvatarUrl(signed?.signedUrl ?? null);
    setUploading(false);
    toast.success("Foto atualizada");
  };

  const handleWipeData = async () => {
    if (!user) return;
    if (wipeConfirm.trim().toUpperCase() !== "LIMPAR") {
      toast.error("Digite LIMPAR para confirmar.");
      return;
    }
    setWiping(true);
    const [pr, se, pa] = await Promise.all([
      (supabase as any).from("patient_progress").delete().eq("user_id", user.id),
      supabase.from("sessions").delete().eq("user_id", user.id),
      supabase.from("patients").delete().eq("user_id", user.id),
    ]);
    setWiping(false);
    if (pr.error || se.error || pa.error) {
      toast.error("Não foi possível limpar todos os dados.");
      return;
    }
    setWipeOpen(false);
    setWipeConfirm("");
    toast.success("Pacientes, sessões e registros foram apagados.");
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up max-w-2xl">
      <header>
        <h1 className="font-display text-4xl font-medium">Perfil</h1>
        <p className="mt-2 text-muted-foreground">Suas informações profissionais.</p>
      </header>

      <section className="rounded-3xl bg-card border border-border shadow-card p-8">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-soft">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <User className="h-10 w-10" />
            )}
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">PNG ou JPG, até 2MB.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="rounded-3xl bg-card border border-border shadow-card p-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clinic_name" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Nome do consultório
          </Label>
          <Input
            id="clinic_name"
            placeholder="Ex.: Espaço Bem-Estar"
            value={form.clinic_name}
            onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Aparece no topo do seu Painel.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile_type">Tipo de perfil</Label>
          <Select value={profileType} onValueChange={(v) => setProfileType(v as ProfileType)}>
            <SelectTrigger id="profile_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Padrão</SelectItem>
              <SelectItem value="supervisee">Membro Parceiro / Supervisionando</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            <strong>Supervisionandos</strong> podem vincular um supervisor. <strong>Supervisores</strong> gerenciam supervisionandos e veem apenas pacientes compartilhados explicitamente.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="crp">CRP</Label>
            <Input id="crp" placeholder="Ex: 06/12345" value={form.crp} onChange={(e) => setForm({ ...form, crp: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialty">Especialidade</Label>
          <Input id="specialty" placeholder="Ex: TCC, Psicanálise..." value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pix_key">Chave Pix</Label>
          <Input id="pix_key" placeholder="CPF, e-mail, telefone ou chave aleatória" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
          <p className="text-xs text-muted-foreground">Usada na mensagem de cobrança via WhatsApp.</p>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="accent" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </form>

      <ServiceCatalog />

      {profileType === "supervisee" && (
        <section className="rounded-3xl bg-card border border-border shadow-card p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Supervisor vinculado</h2>
              <p className="text-xs text-muted-foreground">
                Seu supervisor terá acesso somente leitura aos seus pacientes e sessões.
              </p>
            </div>
          </div>

          {supervisorId ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{supervisorName ?? "Supervisor"}</p>
                  <p className="text-xs text-muted-foreground">Vínculo ativo</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleUnlinkSupervisor} className="shrink-0">
                <X className="h-4 w-4" /> Remover
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="supervisor_email">Email do supervisor</Label>
              <div className="flex gap-2">
                <Input
                  id="supervisor_email"
                  type="email"
                  placeholder="supervisor@exemplo.com"
                  value={supervisorEmail}
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                />
                <Button onClick={handleLinkSupervisor} disabled={linkingSupervisor || !supervisorEmail}>
                  {linkingSupervisor && <Loader2 className="h-4 w-4 animate-spin" />}
                  Vincular
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O supervisor precisa ter conta criada na plataforma com o email informado.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-card border border-border shadow-card p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Privacidade & LGPD</h2>
            <p className="text-xs text-muted-foreground">
              Controle total sobre seus dados — você é o único dono.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Termos de Uso e LGPD</p>
              <p className="text-xs text-muted-foreground">Como tratamos seus dados.</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Ler</span>
        </button>

        <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Download className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Exportar meus dados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Baixe todos os seus pacientes, sessões e registros de humor/progresso. Apenas seus próprios dados são incluídos.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Trash2 className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Limpar meus dados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Apaga permanentemente todos os seus pacientes, sessões e registros de humor/progresso. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => {
              setWipeConfirm("");
              setWipeOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" /> Limpar meus dados
          </Button>
        </div>
      </section>

      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Confirmar limpeza</DialogTitle>
            <DialogDescription>
              Você está prestes a apagar <strong>todos</strong> os seus pacientes, sessões e registros de humor/progresso. Seu perfil e conta permanecem ativos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="wipe_confirm">
              Digite <span className="font-mono font-semibold">LIMPAR</span> para confirmar
            </Label>
            <Input
              id="wipe_confirm"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
              placeholder="LIMPAR"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipeOpen(false)} disabled={wiping}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleWipeData}
              disabled={wiping || wipeConfirm.trim().toUpperCase() !== "LIMPAR"}
            >
              {wiping && <Loader2 className="h-4 w-4 animate-spin" />}
              Apagar tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Termos de Uso e LGPD</DialogTitle>
            <DialogDescription>Versão preliminar — atualizada em maio/2026.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <div>
              <h3 className="font-semibold text-foreground mb-1">1. Sigilo profissional</h3>
              <p>
                Os dados dos seus pacientes são acessados exclusivamente por você. Apenas supervisores explicitamente vinculados por você terão acesso somente leitura aos dados dos seus supervisionandos.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">2. Tratamento de dados (LGPD)</h3>
              <p>
                Seguimos a Lei Geral de Proteção de Dados (Lei 13.709/2018). Os dados são armazenados de forma segura, com criptografia em trânsito e em repouso, e isolamento por usuário no banco de dados (Row Level Security).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">3. Seus direitos</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Acessar e exportar seus dados a qualquer momento.</li>
                <li>Corrigir informações imprecisas.</li>
                <li>Apagar todos os seus registros usando "Limpar meus dados".</li>
                <li>Encerrar sua conta, com remoção definitiva.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">4. Responsabilidade do psicólogo</h3>
              <p>
                Como profissional, você é o controlador dos dados dos pacientes e deve obter o consentimento informado antes de cadastrá-los. A plataforma atua como operadora.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">5. Contato</h3>
              <p>
                Para dúvidas, exercícios de direitos ou notificações de incidentes, entre em contato pelo email do suporte.
              </p>
            </div>
            <p className="text-xs italic">
              Este é um texto padrão. Substitua pelo documento jurídico definitivo antes de produção.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
