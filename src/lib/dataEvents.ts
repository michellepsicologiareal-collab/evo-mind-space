export const SESSION_DATA_CHANGED_EVENT = "psireal:session-data-changed";

export function notifySessionDataChanged() {
  window.dispatchEvent(new Event(SESSION_DATA_CHANGED_EVENT));
}