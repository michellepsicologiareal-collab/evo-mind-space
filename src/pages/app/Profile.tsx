import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Upload, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  crp: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  specialty: z.string().trim().max(120).optional().or(z.literal("")),
});

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ full_name: "", crp: "", phone: "", specialty: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      setForm({
        full_name: data.full_name ?? "",
        crp: data.crp ?? "",
        phone: data.phone ?? "",
        specialty: data.specialty ?? "",
      });
      if (data.avatar_url) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(data.avatar_url, 3600);
        setAvatarUrl(signed?.signedUrl ?? null);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: parsed.data.full_name,
      crp: parsed.data.crp || null,
      phone: parsed.data.phone || null,
      specialty: parsed.data.specialty || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
      return;
    }
    toast.success("Perfil atualizado");
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

    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast.error("Erro ao enviar foto");
      return;
    }

    await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
    setAvatarUrl(signed?.signedUrl ?? null);
    setUploading(false);
    toast.success("Foto atualizada");
  };

  if (loading) {
    return <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-up max-w-2xl">
      <header>
        <h1 className="font-display text-4xl font-medium">Perfil</h1>
        <p className="mt-2 text-muted-foreground">Suas informações profissionais.</p>
      </header>

      <section className="rounded-3xl bg-card border border-border p-8">
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

      <form onSubmit={handleSave} className="rounded-3xl bg-card border border-border p-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
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
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="hero" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
