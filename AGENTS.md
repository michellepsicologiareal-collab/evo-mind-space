# Project architecture

- Keep therapist self-care thought records in an owner-only table separate from patient TCC records, because personal reflections must never appear in patient charts or supervision views.
- Reuse the shared RPD form and serialization for therapist and patient flows, because the cognitive model and graphs must remain consistent.- Patient self-reported mood is stored in patient_progress with wellbeing_source='patient_self_report' via token RPCs on the RPD invite, so patient and therapist series share one table and can be crossed.
