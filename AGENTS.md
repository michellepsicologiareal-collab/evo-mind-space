# Project architecture

- Keep patient financial panels separate from the Finance page and reuse shared billing predicates and existing payment/WhatsApp actions, so financial rules remain consistent across views.
- Date edits in patient financial panels update only the chosen session's scheduled_at and refresh shared session data, preserving time and financial/package fields.

- Keep therapist self-care thought records in an owner-only table separate from patient TCC records, because personal reflections must never appear in patient charts or supervision views.
- Reuse the shared RPD form and serialization for therapist and patient flows, because the cognitive model and graphs must remain consistent.- Patient self-reported mood is stored in patient_progress with wellbeing_source='patient_self_report' via token RPCs on the RPD invite, so patient and therapist series share one table and can be crossed.
