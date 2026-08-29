/**
 * Annotation model for the Lesson Material viewer. Coordinates are stored in
 * "page space" — the PDF page's own viewport at scale 1 — never in screen
 * pixels, so an annotation drawn at any zoom level stays perfectly aligned
 * at every other zoom level (the SVG overlay's `viewBox` does the scaling,
 * not application code). Annotations are per-viewer-session only (kept in
 * component state, not persisted) — see docs/PROGRESS.md for the scope note.
 */

export type AnnotationTool =
  | "select"
  | "rect"
  | "ellipse"
  | "freehand"
  | "arrow"
  | "highlight"
  | "underline"
  | "text"
  | "eraser";

export type Point = { x: number; y: number };

export type Annotation = {
  id: string;
  page: number;
  tool: Exclude<AnnotationTool, "select" | "eraser">;
  color: string;
  strokeWidth: number;
  /** rect / ellipse / highlight / underline */
  box?: { x: number; y: number; w: number; h: number };
  /** freehand / arrow */
  points?: Point[];
  /** text tool */
  text?: string;
};

export const TOOL_COLORS = ["#b23b2e", "#0b6b5c", "#1c4f9c", "#b98a3d", "#1c2521"];
export const HIGHLIGHT_COLOR = "#ffd35c";

export function newAnnotationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
