import { useCallback, useRef, useState } from "react";

/**
 * Tracks whether a form has been touched (dirty).
 * Returns helpers to guard modal close with a confirmation step.
 */
export function useUnsavedGuard() {
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingClose = useRef<(() => void) | null>(null);

  /** Mark form as dirty (user changed something) */
  const markDirty = useCallback(() => setDirty(true), []);

  /** Reset dirty flag (after save or fresh open) */
  const resetDirty = useCallback(() => setDirty(false), []);

  /**
   * Call this instead of directly closing the modal.
   * If dirty, shows confirmation. Otherwise runs closeFn immediately.
   */
  const guardClose = useCallback(
    (closeFn: () => void) => {
      if (dirty) {
        pendingClose.current = closeFn;
        setConfirmOpen(true);
      } else {
        closeFn();
      }
    },
    [dirty]
  );

  /** User confirmed "leave without saving" */
  const confirmLeave = useCallback(() => {
    setConfirmOpen(false);
    setDirty(false);
    pendingClose.current?.();
    pendingClose.current = null;
  }, []);

  /** User chose "save draft and leave" — keeps localStorage intact */
  const saveDraftAndLeave = useCallback(() => {
    setConfirmOpen(false);
    setDirty(false);
    pendingClose.current?.();
    pendingClose.current = null;
  }, []);

  /** User chose "continue editing" */
  const cancelLeave = useCallback(() => {
    setConfirmOpen(false);
    pendingClose.current = null;
  }, []);

  return {
    dirty,
    markDirty,
    resetDirty,
    guardClose,
    confirmOpen,
    confirmLeave,
    saveDraftAndLeave,
    cancelLeave,
  };
}
