import { SessionReadView } from "@/components/app/SessionReadView";

export default function DevSessionDoc() {
  return (
    <SessionReadView
      open
      onOpenChange={() => {}}
      sessionId={null}
      patientName="Otávio Vinicius Moreira Najjar"
      scheduledAt="2026-08-11T10:00:00"
      durationMinutes={50}
      status="confirmed"
      modality="presencial"
      price={95}
      paymentStatus="paid"
      serviceName="Atendimento clínico"
      notes="Plano 4 sessões (2/4) — Pgto único [c859492a-1234-4567-89ab-cdef01234567] observação bem longa para testar quebra de linha em telas estreitas do iPhone Safari."
    />
  );
}
