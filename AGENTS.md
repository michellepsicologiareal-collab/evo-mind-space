# Project architecture

- Keep therapist self-care thought records in an owner-only table separate from patient TCC records, because personal reflections must never appear in patient charts or supervision views.
- Reuse the shared RPD form and serialization for therapist and patient flows, because the cognitive model and graphs must remain consistent.