// ── Shared types ─────────────────────────────────────────────────────

export interface FunctionSlot {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
  error: string | null;
  showDerivative: boolean;
}

export interface ViewPort {
  centerX: number;
  centerY: number;
  scaleX: number; // pixels per unit
  scaleY: number;
}

export interface Point {
  x: number;
  y: number;
}

export const GRAPH_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#be185d", // pink
  "#854d0e", // amber
  "#4338ca", // indigo
  "#065f46", // emerald
];

export const PRESETS: Array<{ label: string; expr: string }> = [
  { label: "Parabola", expr: "x^2" },
  { label: "Sine wave", expr: "sin(x)" },
  { label: "Exponential", expr: "e^x" },
  { label: "Circle r=2", expr: "sqrt(4 - x^2)" },
  { label: "Polynomial", expr: "x^3 - 3x" },
];
