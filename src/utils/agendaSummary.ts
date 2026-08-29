import { format, isSameDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AgendaSummarySession {
  id: string;
  patient_id: string | null;
  scheduled_at: string;
  status: string;
  session_type: string;
  is_expense?: boolean;
  payment_status?: string;
}

export interface AgendaSummaryInput {
  sessions: AgendaSummarySession[];
  selectedDate: Date;
  currentMonth: Date;
  now?: Date;
  sessionRecordIds: Set<string>;
  sessionRecordKeys: Set<string>;
  moodBySession: Map<string, unknown>;
  moodTodayPatients: Set<string>;
}

export interface AgendaSummaryLabels {
  sessions: string;
  pendingRecords: string;
  pendingPayments: string;
  mood: string;
}

export interface AgendaSummary<T extends AgendaSummarySession = AgendaSummarySession> {
  todayCount: number;
  pendingRecords: number;
  pendingPayments: number;
  moodCount: number;
  pendingPaymentList: T[];
  pendingRecordList: T[];
  labels: AgendaSummaryLabels;
}

const INACTIVE_STATUSES = ["cancelled", "no_show", "rescheduled"];

const recordKey = (patientId: string | null, scheduledAt: string) =>
  patientId ? `${patientId}|${new Date(scheduledAt).toISOString().slice(0, 10)}` : "";

/**
 * Contadores e rótulos do painel-resumo da Agenda.
 * Regra: sessões/humor seguem o DIA selecionado; registros e pagamentos
 * pendentes seguem o MÊS exibido, contando até o fim do dia selecionado
 * (ou até "agora" quando o dia selecionado é futuro).
 */
export function computeAgendaSummary<T extends AgendaSummarySession>(input: AgendaSummaryInput & { sessions: T[] }): AgendaSummary<T> {
  const { sessions, selectedDate, currentMonth, sessionRecordIds, sessionRecordKeys, moodBySession, moodTodayPatients } = input;
  const now = input.now ?? new Date();

  const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);
  const inSelectedDay = (d: Date) => d >= dayStart && d <= dayEnd;
  const cutoff = dayEnd < now ? dayEnd : now;

  const isToday = isSameDay(selectedDate, now);

  const todayCount = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return inSelectedDay(d) && s.status !== "cancelled";
  }).length;

  const isPendingRecord = (s: AgendaSummarySession) => {
    const key = recordKey(s.patient_id, s.scheduled_at);
    return (
      s.session_type === "clinical" &&
      !!s.patient_id &&
      new Date(s.scheduled_at) < cutoff &&
      !INACTIVE_STATUSES.includes(s.status) &&
      !sessionRecordIds.has(s.id) &&
      !(key && sessionRecordKeys.has(key))
    );
  };

  const isPendingPayment = (s: AgendaSummarySession) => (
    s.session_type === "clinical" &&
    !s.is_expense &&
    s.payment_status === "pending" &&
    !INACTIVE_STATUSES.includes(s.status) &&
    new Date(s.scheduled_at) < cutoff
  );

  const pendingRecordList = sessions.filter(isPendingRecord)
    .sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));
  const pendingPaymentList = sessions.filter(isPendingPayment)
    .sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));

  const moodCount = isToday
    ? moodTodayPatients.size
    : sessions.filter((s) => inSelectedDay(new Date(s.scheduled_at)) && moodBySession.has(s.id)).length;

  const monthLabel = format(startOfMonth(currentMonth), "MMM", { locale: ptBR });

  const labels: AgendaSummaryLabels = {
    sessions: isToday ? "Sessões de hoje" : `Sessões em ${format(selectedDate, "dd/MM")}`,
    pendingRecords: `Registros pendentes em ${monthLabel}`,
    pendingPayments: `Pagamentos pendentes em ${monthLabel}`,
    mood: isToday ? "Humor respondido hoje" : `Humor em ${format(selectedDate, "dd/MM")}`,
  };

  return {
    todayCount,
    pendingRecords: pendingRecordList.length,
    pendingPayments: pendingPaymentList.length,
    moodCount,
    pendingPaymentList,
    pendingRecordList,
    labels,
  };
}
