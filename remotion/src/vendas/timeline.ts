import timings from "../vendas-timings.json";
import { FPS } from "./theme";

const starts: number[] = timings.starts;
const total: number = timings.total;

// Cada bloco de cena começa um pouco antes da narração correspondente.
const boundarySeconds = starts.map((s, i) => (i === 0 ? 0 : s - 0.4));

export const BOUNDS = boundarySeconds.map((s, i) => {
  const from = Math.round(s * FPS);
  const nextSec = i + 1 < boundarySeconds.length ? boundarySeconds[i + 1] : total;
  return { from, duration: Math.round(nextSec * FPS) - from };
});

export const TOTAL_FRAMES = Math.round(total * FPS);
