import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "O Psi Real é indicado para quem?",
    a: "Para psicólogas clínicas que atendem de forma autônoma — presencial, online ou híbrido — e querem organizar prontuários, agenda, financeiro e evolução dos pacientes em um só lugar.",
  },
  {
    q: "O sistema está alinhado às normas do CRP?",
    a: "Sim. Os fluxos de registro e prontuário foram desenhados considerando o Código de Ética Profissional do Psicólogo, as resoluções do CFP/CRP sobre documentos e registros, e as boas práticas da psicologia baseada em evidências.",
  },
  {
    q: "Meus dados e os dos meus pacientes estão seguros?",
    a: "Sim. Toda comunicação é protegida por HTTPS/TLS. Cada profissional acessa apenas seus próprios dados. Seguimos as diretrizes da LGPD para tratamento de dados sensíveis de saúde.",
  },
  {
    q: "Posso acessar pelo celular?",
    a: "Com certeza. O Psi Real é totalmente responsivo — funciona no navegador do celular, tablet e computador, sem precisar instalar nada.",
  },
  {
    q: "Consigo enviar lembretes de sessão para os pacientes?",
    a: "Sim! Você pode enviar confirmações de sessão por WhatsApp diretamente pela agenda e acompanhar se o paciente confirmou.",
  },
  {
    q: "Como funciona o controle financeiro?",
    a: "Você registra sessões realizadas, cobranças e pagamentos recebidos. O sistema gera relatórios mensais automáticos, diferencia planos de atendimento de sessão única e mostra com clareza o que entrou de verdade no caixa.",
  },
  {
    q: "Existe período de teste gratuito?",
    a: "Sim. Você tem 14 dias grátis para testar todas as funcionalidades, sem cartão de crédito e sem compromisso.",
  },
  {
    q: "Preciso instalar algum programa?",
    a: "Não. O Psi Real funciona 100% no navegador. Basta acessar psireal.app e fazer login.",
  },
  {
    q: "Como posso tirar dúvidas ou pedir ajuda?",
    a: "Clique no botão 'Suporte' no menu e fale diretamente conosco pelo WhatsApp. Respondemos o mais rápido possível!",
  },
];

export const FAQ = () => {
  return (
    <section id="faq" className="py-20 bg-secondary/30">
      <div className="container max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Perguntas Frequentes
          </h2>
          <p className="mt-3 text-muted-foreground">
            Tire suas dúvidas sobre o Psi Real
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card rounded-2xl border border-border/60 px-6 shadow-soft"
            >
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
