import { useCallback, useRef, useState } from "react";

/**
 * Tracks whether a form has been touched (dirty).
 * Returns helpers to guard modal close with a confirmation step.
 */
export function useUnsavedGuard() {
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingClose = useRef<(() => void) | null>(null);
  const pendingCloseOnly = useRef<(() => void) | null>(null);

  /** Mark form as dirty (user changed something) */
  const markDirty = useCallback(() => setDirty(true), []);

  /** Reset dirty flag (after save or fresh open) */
  const resetDirty = useCallback(() => setDirty(false), []);

  /**
   * Call this instead of directly closing the modal.
   * closeFn: runs on "exit without saving" (typically clears draft + closes)
   * closeOnlyFn: optional, runs on "save draft and exit" (just closes, keeps draft)
   */
  const guardClose = useCallback(
    (closeFn: () => void, closeOnlyFn?: () => void) => {
      if (dirty) {
        pendingClose.current = closeFn;
        pendingCloseOnly.current = closeOnlyFn ?? null;
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
    pendingCloseOnly.current = null;
  }, []);

  /** User chose "save draft and leave" — keeps localStorage intact, just closes */
  const saveDraftAndLeave = useCallback(() => {
    setConfirmOpen(false);
    setDirty(false);
    if (pendingCloseOnly.current) {
      pendingCloseOnly.current();
    } else {
      // fallback: just close like confirmLeave but without clearing
      pendingClose.current?.();
    }
    pendingClose.current = null;
    pendingCloseOnly.current = null;
  }, []);

  /** User chose "continue editing" */
  const cancelLeave = useCallback(() => {
    setConfirmOpen(false);
    pendingClose.current = null;
    pendingCloseOnly.current = null;
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
