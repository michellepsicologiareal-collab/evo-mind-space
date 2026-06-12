/**
 * Preserve window scroll position across an async UI update
 * (e.g. closing a dialog + reloading a list after saving).
 *
 * Captures scrollY now, awaits the work, then restores the scroll
 * on the next two animation frames (after React paints the new layout).
 */
export async function preserveScroll<T>(work: () => Promise<T> | T): Promise<T> {
  const y = window.scrollY;
  const x = window.scrollX;
  try {
    return await work();
  } finally {
    const restore = () => window.scrollTo({ left: x, top: y, behavior: "auto" });
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
      // Safety net: some layouts settle a bit later (images, async data).
      setTimeout(restore, 120);
    });
  }
}

/** Synchronous variant: capture now, restore on next frames. */
export function keepScroll() {
  const y = window.scrollY;
  const x = window.scrollX;
  const restore = () => window.scrollTo({ left: x, top: y, behavior: "auto" });
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 120);
  });
}
