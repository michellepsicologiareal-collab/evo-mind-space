import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Copy, Eraser, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Patient = { id: string; full_name: string };

export default function FormulacaoLivre() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>("none");
  const [patientName, setPatientName] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [supervision, setSupervision] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setPatients((data ?? []) as Patient[]);
    })();
  }, [user]);

  const selectedName = useMemo(() => {
    if (patientId === "none") return patientName.trim();
    return patients.find((p) => p.id === patientId)?.full_name || "";
  }, [patientId, patientName, patients]);

  const generate = async () => {
    if (rawText.trim().length < 30) {
      toast.error("Escreva ao menos algumas frases sobre o caso (mín. 30 caracteres).");
      return;
    }
    setLoading(true);
    setSupervision("");
    try {
      const { data, error } = await supabase.functions.invoke("supervise-formulation", {
        body: { raw_text: rawText, patient_name: selectedName },
      });
      if (error) throw error;
      const sup = (data as any)?.supervision as string | undefined;
      if (!sup) {
        toast.error((data as any)?.error || "Não foi possível gerar a supervisão.");
        return;
      }
      setSupervision(sup);
      toast.success("Supervisão TCC gerada.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar.");
    } finally {
      setLoading(false);
    }
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(supervision);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        <header className="space-y-1">
          <h1 className="font-display" style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-0.3px", color: "hsl(var(--foreground))" }}>
            Formulação livre · Supervisão IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Escreva o caso do jeito que vier — bagunçado, fragmentado, em rascunho. A IA devolve uma supervisão TCC no estilo Padesky/Beck.
          </p>
        </header>

        <section className="bg-white rounded-[10px] p-5 space-y-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente cadastrado (opcional)</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">— Caso avulso / sem cadastro —</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {patientId === "none" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome/Apelido do caso</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Ex: Caso M., 32 anos" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relato livre do caso</Label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Escreva sem se preocupar com estrutura. Ex: 'M., 32 anos, casada, queixa de ansiedade no trabalho há 6 meses, evita reuniões, palpitação, pensa que vai ser demitida, pai crítico na infância, dorme mal, já fez terapia em 2020...'"
              className="min-h-[220px] resize-y text-sm leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">{rawText.length} caracteres · mínimo 30</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={loading} variant="accent">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Supervisora analisando..." : supervision ? "Regenerar supervisão" : "Pedir supervisão TCC"}
            </Button>
            {(rawText || supervision) && (
              <Button variant="outline" onClick={() => { setRawText(""); setSupervision(""); }}>
                <Eraser className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </section>

        {supervision && (
          <section className="bg-white rounded-[10px] p-5 sm:p-6 space-y-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>Devolutiva da supervisora TCC</h2>
              </div>
              <Button variant="outline" size="sm" onClick={copyMd}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
            </div>
            <article
              className="prose prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-strong:text-foreground"
              style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "hsl(var(--foreground))" }}
            >
              {supervision}
            </article>
          </section>
        )}
      </div>
    </div>
  );
}
