import { supabase } from "@/integrations/supabase/client";

type ResourceType = "patient" | "session" | "case_formulation" | "session_evolution" | "tcc_record" | "patient_progress";

/**
 * Log access to clinical data for audit trail.
 * Fire-and-forget — never blocks the UI.
 */
export const logClinicalAccess = (
  resourceType: ResourceType,
  resourceId: string,
  patientId?: string
) => {
  supabase.rpc("log_clinical_access", {
    _resource_type: resourceType,
    _resource_id: resourceId,
    _access_type: "own",
    _result: "success",
    _block_reason: null,
    _patient_id: patientId ?? null,
  }).then(({ error }) => {
    if (error) console.warn("[audit]", error.message);
  });
};

/**
 * Log supervision access for audit trail.
 */
export const logSupervisionAccess = (
  resourceType: ResourceType,
  resourceId: string,
  superviseeId: string,
  patientId: string
) => {
  supabase.rpc("log_supervision_access", {
    _resource_type: resourceType,
    _resource_id: resourceId,
    _supervisee_id: superviseeId,
    _patient_id: patientId,
    _result: "success",
    _block_reason: null,
  }).then(({ error }) => {
    if (error) console.warn("[audit]", error.message);
  });
};

/**
 * Log a blocked access attempt.
 */
export const logBlockedAccess = (
  resourceType: ResourceType,
  resourceId: string,
  reason: string
) => {
  supabase.rpc("log_clinical_access", {
    _resource_type: resourceType,
    _resource_id: resourceId,
    _access_type: "own",
    _result: "blocked",
    _block_reason: reason,
    _patient_id: null,
  }).then(({ error }) => {
    if (error) console.warn("[audit]", error.message);
  });
};
