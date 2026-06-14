import { useEffect, useState } from "react";
import { Download, Eye, Lock, FileText, BookOpen, Scale } from "lucide-react";
import { ListSkeleton } from "@/components/app/Skeletons";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PremiumGate } from "@/components/app/PremiumGate";
import { PageIntro } from "@/components/app/PageIntro";

type Category = "documentos_legais" | "materiais_pacientes" | "guias_tcc";

interface Material {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  file_url: string | null;
  is_premium: boolean;
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof FileText; description: string }> = {
  documentos_legais: {
    label: "Documentos Legais",
    icon: Scale,
    description: "Contratos, termos de consentimento e modelos jurídicos",
  },
  materiais_pacientes: {
    label: "Materiais para Pacientes",
    icon: BookOpen,
    description: "Leituras, tarefas de casa e psicoeducação",
  },
  guias_tcc: {
    label: "Guias TCC / Esquema",
    icon: FileText,
    description: "Protocolos, conceituações e fichas técnicas",
  },
};

const Library = () => {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("library_materials")
        .select("*")
        .order("title");
      if (error) toast.error("Erro ao carregar biblioteca");
      setMaterials((data as Material[]) ?? []);
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  const handleAccess = async (m: Material) => {
    if (m.is_premium && !isPremium) {
      setGateOpen(true);
      return;
    }
    if (m.file_url) {
      // Extract bucket path from full URL or use as-is
      const path = m.file_url.includes("/storage/v1/object/public/library/")
        ? m.file_url.split("/storage/v1/object/public/library/")[1]
        : m.file_url;
      const { data, error } = await supabase.storage
        .from("library")
        .createSignedUrl(path, 3600); // 1 hour
      if (error || !data?.signedUrl) {
        toast.error("Erro ao gerar link de acesso.");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } else {
      toast.info("Arquivo ainda não disponível.");
    }
  };

  const byCategory = (cat: Category) => materials.filter((m) => m.category === cat);

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-up">
        <header>
          <div className="h-10 w-56 rounded bg-muted animate-pulse" />
          <div className="h-4 w-80 rounded bg-muted animate-pulse mt-3" />
        </header>
        <ListSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <header>
        <h1 className="font-display text-4xl font-medium">Biblioteca Clínica</h1>
        <p className="mt-2 text-muted-foreground">
          Curadoria de materiais essenciais para a sua prática clínica.
        </p>
      </header>

      <PageIntro description="Materiais de referência (escalas, protocolos clínicos, modelos legais e éticos) para consultar e baixar quando precisar — sem precisar sair do sistema durante a clínica." />


      <Tabs defaultValue="documentos_legais">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
          {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const count = byCategory(cat).length;
            return (
              <TabsTrigger
                key={cat}
                value={cat}
                className="data-[state=active]:bg-card data-[state=active]:shadow-card rounded-xl px-4 py-2.5 text-sm"
              >
                <meta.icon className="h-4 w-4 mr-1.5" />
                {meta.label} {count > 0 && <span className="ml-1 text-xs text-muted-foreground">({count})</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
          const meta = CATEGORY_META[cat];
          const items = byCategory(cat);
          return (
            <TabsContent key={cat} value={cat} className="mt-6">
              <p className="text-sm text-muted-foreground mb-4">{meta.description}</p>

              {items.length === 0 ? (
                <div className="rounded-2xl bg-card border border-border p-12 text-center">
                  <meta.icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Nenhum material nesta categoria ainda.</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Em breve novos conteúdos serão adicionados.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-card border border-border p-5 flex flex-col hover:shadow-card transition-shadow"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shrink-0">
                          <FileText className="h-5 w-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-tight">{m.title}</h3>
                          {m.is_premium && !isPremium && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-gold">
                              <Lock className="h-3 w-3" /> Premium
                            </span>
                          )}
                        </div>
                      </div>

                      {m.description && (
                        <p className="text-xs text-muted-foreground mb-4 flex-1 line-clamp-3">
                          {m.description}
                        </p>
                      )}

                      <Button
                        variant={m.is_premium && !isPremium ? "outline" : "accent"}
                        size="default"
                        className="w-full mt-auto min-h-[44px]"
                        onClick={() => handleAccess(m)}
                      >
                        {m.is_premium && !isPremium ? (
                          <><Lock className="h-3.5 w-3.5" /> Disponível para Assinantes</>
                        ) : m.file_url ? (
                          <><Download className="h-3.5 w-3.5" /> Baixar</>
                        ) : (
                          <><Eye className="h-3.5 w-3.5" /> Visualizar</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <PremiumGate open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
};

export default Library;
