import { ShieldAlert } from "lucide-react";

/**
 * MÓDULO EM MANUTENÇÃO — CONTENÇÃO DE PRIVACIDADE
 *
 * A tela de Humor foi temporariamente desativada após um relato de possível
 * exibição de registros pertencentes a outra profissional. Nenhum dado
 * clínico é buscado ou renderizado enquanto a investigação de isolamento
 * multitenant estiver em andamento.
 *
 * O código completo do painel (KPIs, gráficos, sheet do paciente, queries
 * a patients/patient_progress/sessions) permanece preservado no histórico
 * do Git — não foi apagado, só está inacessível pela rota /app/humor.
 */
export default function Humor() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
      <div
        role="alert"
        aria-live="polite"
        className="rounded-2xl border border-border bg-card shadow-sm p-8 sm:p-10 text-center space-y-4"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Este módulo está temporariamente indisponível
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estamos realizando uma verificação de segurança e privacidade neste painel.
          Nenhum registro clínico é exibido durante a manutenção. Os demais módulos
          do sistema (Agenda, Pacientes, Sessões) continuam funcionando normalmente.
        </p>
        <p className="text-xs text-muted-foreground/80">
          Assim que a verificação for concluída, o painel será restabelecido.
        </p>
      </div>
    </div>
  );
}
