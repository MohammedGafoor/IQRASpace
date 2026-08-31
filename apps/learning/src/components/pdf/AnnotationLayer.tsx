"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Annotation, AnnotationTool, Point } from "./annotationTypes";
import { newAnnotationId } from "./annotationTypes";
import { boxFromPoints, clientToViewBoxPoint } from "./svgCoords";

const DRAG_TOOLS: AnnotationTool[] = ["rect", "ellipse", "highlight", "underline", "arrow"];

function annotationBounds(a: Annotation) {
  if (a.box) return a.box;
  if (a.points && a.points.length > 0) {
    const xs = a.points.map((p) => p.x);
    const ys = a.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

export function AnnotationLayer({
  pageSize,
  renderSize,
  annotations,
  activeTool,
  color,
  strokeWidth,
  selectedId,
  onCommit,
  onSelect,
  onErase,
  onTextCommit,
}: {
  pageSize: { width: number; height: number };
  renderSize: { width: number; height: number };
  annotations: Annotation[];
  activeTool: AnnotationTool;
  color: string;
  strokeWidth: number;
  selectedId: string | null;
  onCommit: (a: Annotation) => void;
  onSelect: (id: string | null) => void;
  onErase: (id: string) => void;
  onTextCommit: (point: Point, text: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [draftEnd, setDraftEnd] = useState<Point | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [textDraft, setTextDraft] = useState<{ point: Point; value: string } | null>(null);

  function pointFromEvent(e: PointerEvent) {
    if (!svgRef.current) return { x: 0, y: 0 };
    return clientToViewBoxPoint(svgRef.current, e.clientX, e.clientY);
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    // Without this, the browser's own default mousedown handling (focus
    // management for whatever the *original* target was) fires right after
    // our handler and immediately blurs the text-input we're about to
    // create/focus — discarding the draft before the user can type.
    e.preventDefault();
    if (activeTool === "select" || activeTool === "eraser") {
      onSelect(null);
      return;
    }
    const p = pointFromEvent(e);
    if (activeTool === "text") {
      setTextDraft({ point: p, value: "" });
      return;
    }
    if (activeTool === "freehand") {
      setDraftPoints([p]);
      return;
    }
    setDragStart(p);
    setDraftEnd(p);
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (activeTool === "freehand" && draftPoints.length > 0) {
      const p = pointFromEvent(e);
      setDraftPoints((prev) => [...prev, p]);
      return;
    }
    if (dragStart && DRAG_TOOLS.includes(activeTool)) {
      setDraftEnd(pointFromEvent(e));
    }
  }

  function handlePointerUp() {
    if (activeTool === "freehand" && draftPoints.length > 1) {
      onCommit({
        id: newAnnotationId(),
        page: 0, // filled in by caller
        tool: "freehand",
        color,
        strokeWidth,
        points: draftPoints,
      });
    }
    setDraftPoints([]);

    if (dragStart && draftEnd && DRAG_TOOLS.includes(activeTool)) {
      if (activeTool === "arrow") {
        const dx = draftEnd.x - dragStart.x;
        const dy = draftEnd.y - dragStart.y;
        if (Math.hypot(dx, dy) > 2) {
          onCommit({
            id: newAnnotationId(),
            page: 0,
            tool: "arrow",
            color,
            strokeWidth,
            points: [dragStart, draftEnd],
          });
        }
      } else {
        const box = boxFromPoints(dragStart, draftEnd);
        if (box.w > 2 && box.h > 2) {
          onCommit({
            id: newAnnotationId(),
            page: 0,
            tool: activeTool as Annotation["tool"],
            color: activeTool === "highlight" ? color : color,
            strokeWidth,
            box,
          });
        }
      }
    }
    setDragStart(null);
    setDraftEnd(null);
  }

  function commitText() {
    if (textDraft && textDraft.value.trim()) {
      onTextCommit(textDraft.point, textDraft.value.trim());
    }
    setTextDraft(null);
  }

  const scaleX = renderSize.width / pageSize.width || 1;
  const scaleY = renderSize.height / pageSize.height || 1;

  return (
    <div className="absolute inset-0" style={{ width: renderSize.width, height: renderSize.height }}>
      <svg
        ref={svgRef}
        data-annotation-layer="true"
        viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
        width={renderSize.width}
        height={renderSize.height}
        className={
          activeTool === "select"
            ? "cursor-default"
            : activeTool === "eraser"
              ? "cursor-cell"
              : activeTool === "text"
                ? "cursor-text"
                : "cursor-crosshair"
        }
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
          </marker>
        </defs>

        {annotations.map((a) => {
          const bounds = annotationBounds(a);
          const isSelected = a.id === selectedId;
          const hitRect = (
            <rect
              x={bounds.x - 4}
              y={bounds.y - 4}
              width={bounds.w + 8}
              height={bounds.h + 8}
              fill="transparent"
              pointerEvents={activeTool === "select" || activeTool === "eraser" ? "fill" : "none"}
              className={activeTool === "eraser" ? "cursor-cell" : "cursor-pointer"}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (activeTool === "eraser") onErase(a.id);
                else if (activeTool === "select") onSelect(a.id);
              }}
            />
          );

          let shape: ReactNode = null;
          if (a.tool === "rect" && a.box) {
            shape = <rect x={a.box.x} y={a.box.y} width={a.box.w} height={a.box.h} fill="none" stroke={a.color} strokeWidth={a.strokeWidth} />;
          } else if (a.tool === "ellipse" && a.box) {
            shape = (
              <ellipse
                cx={a.box.x + a.box.w / 2}
                cy={a.box.y + a.box.h / 2}
                rx={Math.max(a.box.w / 2, 1)}
                ry={Math.max(a.box.h / 2, 1)}
                fill="none"
                stroke={a.color}
                strokeWidth={a.strokeWidth}
              />
            );
          } else if (a.tool === "highlight" && a.box) {
            shape = <rect x={a.box.x} y={a.box.y} width={a.box.w} height={a.box.h} fill={a.color} fillOpacity={0.35} stroke="none" />;
          } else if (a.tool === "underline" && a.box) {
            shape = (
              <line
                x1={a.box.x}
                y1={a.box.y + a.box.h}
                x2={a.box.x + a.box.w}
                y2={a.box.y + a.box.h}
                stroke={a.color}
                strokeWidth={a.strokeWidth * 2}
                strokeLinecap="round"
              />
            );
          } else if (a.tool === "arrow" && a.points && a.points.length >= 2) {
            const [start, end] = a.points;
            shape = (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={a.color}
                strokeWidth={a.strokeWidth}
                markerEnd="url(#arrowhead)"
              />
            );
          } else if (a.tool === "freehand" && a.points) {
            const d = a.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
            shape = <path d={d} fill="none" stroke={a.color} strokeWidth={a.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
          } else if (a.tool === "text" && a.box) {
            shape = (
              <text x={a.box.x} y={a.box.y} fontSize={20} fill={a.color} fontFamily="var(--font-sans, sans-serif)">
                {a.text}
              </text>
            );
          }

          return (
            <g key={a.id}>
              {shape}
              {isSelected && (
                <rect
                  x={bounds.x - 3}
                  y={bounds.y - 3}
                  width={bounds.w + 6}
                  height={bounds.h + 6}
                  fill="none"
                  stroke="#0b6b5c"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              )}
              {hitRect}
            </g>
          );
        })}

        {/* live draft while dragging */}
        {dragStart && draftEnd && activeTool !== "arrow" && activeTool !== "freehand" && (
          <rect
            x={boxFromPoints(dragStart, draftEnd).x}
            y={boxFromPoints(dragStart, draftEnd).y}
            width={boxFromPoints(dragStart, draftEnd).w}
            height={boxFromPoints(dragStart, draftEnd).h}
            fill={activeTool === "highlight" ? color : "none"}
            fillOpacity={activeTool === "highlight" ? 0.35 : undefined}
            stroke={activeTool === "underline" ? "none" : color}
            strokeDasharray={activeTool === "underline" ? undefined : "5 3"}
            strokeWidth={strokeWidth}
            pointerEvents="none"
          />
        )}
        {dragStart && draftEnd && activeTool === "arrow" && (
          <line x1={dragStart.x} y1={dragStart.y} x2={draftEnd.x} y2={draftEnd.y} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 3" pointerEvents="none" />
        )}
        {draftPoints.length > 1 && (
          <path
            d={draftPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
      </svg>

      {textDraft && (
        <input
          autoFocus
          value={textDraft.value}
          onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText();
            if (e.key === "Escape") setTextDraft(null);
          }}
          placeholder="Type a note…"
          className="absolute rounded border border-primary bg-surface px-1.5 py-0.5 text-sm shadow-[var(--shadow-m)]"
          style={{
            left: textDraft.point.x * scaleX,
            top: textDraft.point.y * scaleY - 10,
            width: 160,
          }}
        />
      )}
    </div>
  );
}
