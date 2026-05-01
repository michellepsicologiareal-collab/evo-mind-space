import { ArrowLeft, Award, Brain, CheckCircle, Heart, Lock, Mail, MapPin, MessageCircle, Phone, Shield, Sparkles, Star, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5511947388423";

const SupervisaoCaso = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const patientName = params.get("paciente") ?? "";

  const msgSupervisao = encodeURIComponent(
    `Olá Michelle, preciso de supervisão para um caso do app${patientName ? ` (paciente: ${patientName})` : ""}.`
  );
  const msgConsulta = encodeURIComponent(
    "Olá Michelle, gostaria de agendar uma consulta individual."
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Photo placeholder */}
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shrink-0 border-2 border-accent/30">
              <Brain className="h-12 w-12 text-accent/60" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-accent uppercase tracking-wider">Supervisão Clínica</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Michelle Donegá</h1>
              <p className="text-muted-foreground font-medium">CRP 06/93008</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Psicóloga (FMU)", "Especialista em TCC", "Terapia do Esquema (Wainer/Cognitivo)", "Hipnose Ericksoniana"].map((t) => (
                  <span key={t} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Diferencial */}
        <section className="rounded-2xl bg-card border border-border p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Cuidado psicológico com excelência</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ajudo você a sair do piloto automático e destravar casos complexos com TCC e Terapia do Esquema.
                Com mais de 8 anos de experiência clínica, ofereço supervisão individualizada para que você desenvolva
                segurança e profundidade no manejo de seus pacientes.
              </p>
            </div>
          </div>
        </section>

        {/* Serviços */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Serviços
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: Brain, label: "Terapia Individual" },
              { icon: Heart, label: "Ansiedade" },
              { icon: Users, label: "Terapia de Casal" },
              { icon: Star, label: "Alta Performance" },
              { icon: Shield, label: "Supervisão Clínica" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-card border border-border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium text-sm">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Prova social */}
        <section className="rounded-2xl bg-card border border-border p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> O que dizem sobre mim
          </h2>
          <blockquote className="border-l-4 border-accent pl-4 italic text-muted-foreground leading-relaxed">
            "Sou acompanhada pela Michelle desde 2017 e posso dizer com segurança que ela é uma profissional excepcional.
            Sua habilidade de empatia e reflexão me ajudou em momentos decisivos da minha vida. Ela tem um dom raro de
            nos fazer enxergar o que está por trás das nossas emoções, sempre com acolhimento e respeito."
          </blockquote>
          <p className="mt-3 text-sm font-medium text-foreground">— I.N., paciente desde 2017</p>
        </section>

        {/* Diferenciais */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" /> Diferenciais
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: Heart, title: "Cuidado individualizado", desc: "Cada caso é tratado de forma única e personalizada." },
              { icon: Lock, title: "Confidencialidade absoluta", desc: "Sigilo total sobre informações clínicas." },
              { icon: Sparkles, title: "Ambiente sofisticado", desc: "Consultório acolhedor em Jarinu/SP." },
              { icon: Shield, title: "Técnicas baseadas em evidências", desc: "TCC, Terapia do Esquema e Hipnose Ericksoniana." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl bg-card border border-border p-4 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section className="rounded-2xl bg-gradient-to-br from-accent/5 to-primary/5 border border-accent/20 p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-2xl font-extrabold">Pronta para destravar seus casos?</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Agende sua supervisão ou consulta diretamente pelo WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              variant="accent"
              size="lg"
              onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msgSupervisao}`, "_blank")}
            >
              <MessageCircle className="h-4 w-4" /> Agendar Supervisão deste Caso
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msgConsulta}`, "_blank")}
            >
              <MessageCircle className="h-4 w-4" /> Agendar Consulta Individual
            </Button>
          </div>
        </section>

        {/* Contato */}
        <section className="rounded-2xl bg-card border border-border p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-4">Contato</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>R. Natale Bernucci, 23 - sala 5, Jarinu/SP</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href="mailto:transformepsicologia@gmail.com" className="text-primary hover:underline">
                transformepsicologia@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                WhatsApp
              </a>
            </div>
            <div className="flex items-center gap-3">
              <svg className="h-4 w-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              <a href="https://instagram.com/michelle.donega" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @michelle.donega
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupervisaoCaso;
