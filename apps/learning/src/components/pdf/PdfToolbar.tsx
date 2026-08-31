"use client";

import type { AnnotationTool } from "./annotationTypes";
import { TOOL_COLORS } from "./annotationTypes";
import { cx } from "@/components/ui/classNames";

const TOOLS: { tool: AnnotationTool; icon: string; label: string }[] = [
  { tool: "select", icon: "↖", label: "Select / move" },
  { tool: "rect", icon: "▭", label: "Rectangle" },
  { tool: "ellipse", icon: "◯", label: "Circle / ellipse" },
  { tool: "freehand", icon: "✎", label: "Freehand drawing" },
  { tool: "arrow", icon: "↗", label: "Arrow" },
  { tool: "highlight", icon: "🖍", label: "Highlight / marker" },
  { tool: "underline", icon: "▂", label: "Underline" },
  { tool: "text", icon: "T", label: "Text annotation" },
  { tool: "eraser", icon: "⌫", label: "Eraser — click an annotation to delete it" },
];

export function PdfToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearAll,
  onDeleteSelected,
  hasSelection,
}: {
  activeTool: AnnotationTool;
  onToolChange: (t: AnnotationTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearAll: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}) {
  const showColors = !["select", "eraser"].includes(activeTool);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper-alt px-3 py-2">
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            title={t.label}
            aria-label={t.label}
            onClick={() => onToolChange(t.tool)}
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-[8px] border text-sm font-bold",
              activeTool === t.tool ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-soft hover:border-primary hover:text-primary"
            )}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* `invisible` (not conditional rendering) keeps this row's height reserved
          so the viewer below doesn't shift position when switching tools. */}
      <div className={cx("flex items-center gap-1 border-l border-line pl-2", !showColors && "invisible")}>
        {TOOL_COLORS.map((c) => (
          <button
            key={c}
            title={`Color: ${c}`}
            aria-label={`Color ${c}`}
            onClick={() => onColorChange(c)}
            className={cx("h-6 w-6 rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 border-l border-line pl-2">
        <button title="Undo" aria-label="Undo" disabled={!canUndo} onClick={onUndo} className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-line bg-surface text-sm disabled:opacity-35">
          ↶
        </button>
        <button title="Redo" aria-label="Redo" disabled={!canRedo} onClick={onRedo} className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-line bg-surface text-sm disabled:opacity-35">
          ↷
        </button>
        <button
          title="Delete selected annotation"
          aria-label="Delete selected annotation"
          disabled={!hasSelection}
          onClick={onDeleteSelected}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-line bg-surface text-sm disabled:opacity-35"
        >
          🗑
        </button>
        <button
          title="Clear all annotations on this page"
          aria-label="Clear all annotations on this page"
          onClick={onClearAll}
          className="flex h-8 items-center justify-center rounded-[8px] border border-line bg-surface px-2 text-xs font-semibold text-danger"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
