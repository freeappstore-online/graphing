import { useRef, useEffect, useCallback, useState } from "react";
import type { FunctionSlot, ViewPort, Point } from "./types";
import type { CompiledFn } from "./parser";
import { numericalDerivative, findIntersections } from "./parser";

interface Props {
  slots: FunctionSlot[];
  viewport: ViewPort;
  setViewport: React.Dispatch<React.SetStateAction<ViewPort>>;
  getCompiled: (expr: string) => CompiledFn | null;
  traceEnabled: boolean;
  showIntersections: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// ── Pick a nice grid step ────────────────────────────────────────────

function niceStep(rawStep: number): number {
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / Math.pow(10, exponent);
  let nice: number;
  if (fraction <= 1.5) nice = 1;
  else if (fraction <= 3.5) nice = 2;
  else if (fraction <= 7.5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exponent);
}

// ── Format axis label ────────────────────────────────────────────────

function formatLabel(val: number, step: number): string {
  if (Math.abs(val) < step * 0.01) return "0";
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return val.toFixed(Math.min(decimals, 10));
}

// ── Component ────────────────────────────────────────────────────────

export default function GraphCanvas({
  slots,
  viewport,
  setViewport,
  getCompiled,
  traceEnabled,
  showIntersections,
  canvasRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const dragRef = useRef<{ startX: number; startY: number; cx: number; cy: number } | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);

  // ── Resize observer ──────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ w: Math.floor(width), h: Math.floor(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Draw ─────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size.w;
    const h = size.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const vp = viewport;
    const styles = getComputedStyle(document.documentElement);
    const lineColor = styles.getPropertyValue("--line").trim() || "#e5e7eb";
    const lineStrongColor = styles.getPropertyValue("--line-strong").trim() || "#d1d5db";
    const inkColor = styles.getPropertyValue("--ink").trim() || "#1a1a1a";
    const mutedColor = styles.getPropertyValue("--muted").trim() || "#6b7280";
    const paperColor = styles.getPropertyValue("--paper").trim() || "#ffffff";

    // clear
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, w, h);

    // world bounds
    const [xMin] = screenToWorld(0, 0, vp, w, h);
    const [xMax] = screenToWorld(w, 0, vp, w, h);
    const [, yMax] = screenToWorld(0, 0, vp, w, h);
    const [, yMin] = screenToWorld(0, h, vp, w, h);

    // grid
    const targetPixelStep = 80;
    const rawStepX = targetPixelStep / vp.scaleX;
    const rawStepY = targetPixelStep / vp.scaleY;
    const stepX = niceStep(rawStepX);
    const stepY = niceStep(rawStepY);

    // minor grid lines
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.5;

    const startX = Math.floor(xMin / stepX) * stepX;
    for (let gx = startX; gx <= xMax; gx += stepX) {
      const [sx] = worldToScreen(gx, 0, vp, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }

    const startY = Math.floor(yMin / stepY) * stepY;
    for (let gy = startY; gy <= yMax; gy += stepY) {
      const [, sy] = worldToScreen(0, gy, vp, w, h);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // axis crosshairs
    const [ox, oy] = worldToScreen(0, 0, vp, w, h);
    ctx.strokeStyle = lineStrongColor;
    ctx.lineWidth = 1.5;

    // x-axis
    if (oy >= 0 && oy <= h) {
      ctx.beginPath();
      ctx.moveTo(0, oy);
      ctx.lineTo(w, oy);
      ctx.stroke();
    }
    // y-axis
    if (ox >= 0 && ox <= w) {
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, h);
      ctx.stroke();
    }

    // axis labels
    ctx.fillStyle = mutedColor;
    ctx.font = "11px Manrope, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let gx = startX; gx <= xMax; gx += stepX) {
      if (Math.abs(gx) < stepX * 0.01) continue;
      const [sx] = worldToScreen(gx, 0, vp, w, h);
      const labelY = Math.min(Math.max(oy + 4, 2), h - 14);
      ctx.fillText(formatLabel(gx, stepX), sx, labelY);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let gy = startY; gy <= yMax; gy += stepY) {
      if (Math.abs(gy) < stepY * 0.01) continue;
      const [, sy] = worldToScreen(0, gy, vp, w, h);
      const labelX = Math.min(Math.max(ox - 6, 30), w - 4);
      ctx.fillText(formatLabel(gy, stepY), labelX, sy);
    }

    // origin label
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    if (ox >= 0 && ox <= w && oy >= 0 && oy <= h) {
      ctx.fillText("0", ox - 4, oy + 4);
    }

    // ── Plot functions ───────────────────────────────────────────────
    const compiledSlots: Array<{
      slot: FunctionSlot;
      fn: (x: number) => number;
    }> = [];

    for (const slot of slots) {
      if (!slot.visible || !slot.expr.trim()) continue;
      const compiled = getCompiled(slot.expr);
      if (!compiled) continue;
      compiledSlots.push({ slot, fn: compiled.fn });
    }

    for (const { slot, fn } of compiledSlots) {
      // main curve
      drawCurve(ctx, fn, xMin, xMax, w, h, vp, slot.color, 2.5);

      // derivative
      if (slot.showDerivative) {
        const dFn = (x: number) => numericalDerivative(fn, x);
        drawCurve(ctx, dFn, xMin, xMax, w, h, vp, slot.color, 1.2, [6, 4]);
      }
    }

    // ── Intersections ────────────────────────────────────────────────
    if (showIntersections && compiledSlots.length >= 2) {
      for (let i = 0; i < compiledSlots.length; i++) {
        for (let j = i + 1; j < compiledSlots.length; j++) {
          const fi = compiledSlots[i]!;
          const fj = compiledSlots[j]!;
          const pts = findIntersections(fi.fn, fj.fn, xMin, xMax);
          for (const pt of pts) {
            const [sx, sy] = worldToScreen(pt.x, pt.y, vp, w, h);
            if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
            ctx.fillStyle = inkColor;
            ctx.fill();
            ctx.strokeStyle = paperColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // label
            ctx.fillStyle = inkColor;
            ctx.font = "11px Manrope, system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(
              `(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`,
              sx + 8,
              sy - 4,
            );
          }
        }
      }
    }

    // ── Trace mode ───────────────────────────────────────────────────
    if (traceEnabled && mousePos) {
      const [mx] = screenToWorld(mousePos.x, mousePos.y, vp, w, h);

      // vertical guide line
      const [traceSx] = worldToScreen(mx, 0, vp, w, h);
      ctx.strokeStyle = mutedColor;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(traceSx, 0);
      ctx.lineTo(traceSx, h);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const { slot, fn } of compiledSlots) {
        try {
          const y = fn(mx);
          if (!isFinite(y)) continue;
          const [sx, sy] = worldToScreen(mx, y, vp, w, h);
          if (sy < -20 || sy > h + 20) continue;

          // dot
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = slot.color;
          ctx.fill();
          ctx.strokeStyle = paperColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // label
          ctx.fillStyle = slot.color;
          ctx.font = "bold 11px Manrope, system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(
            `(${mx.toFixed(3)}, ${y.toFixed(3)})`,
            sx + 8,
            sy - 4,
          );
        } catch {
          // skip
        }
      }
    }
  }, [
    size,
    viewport,
    slots,
    getCompiled,
    traceEnabled,
    showIntersections,
    mousePos,
    canvasRef,
  ]);

  // ── Schedule draw via rAF ────────────────────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw]);

  // ── Mouse handlers ───────────────────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport((vp) => ({
        ...vp,
        scaleX: Math.max(1, Math.min(10000, vp.scaleX * factor)),
        scaleY: Math.max(1, Math.min(10000, vp.scaleY * factor)),
      }));
    },
    [setViewport],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        cx: viewport.centerX,
        cy: viewport.centerY,
      };
    },
    [viewport.centerX, viewport.centerY],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setViewport((vp) => ({
        ...vp,
        centerX: dragRef.current!.cx - dx / vp.scaleX,
        centerY: dragRef.current!.cy + dy / vp.scaleY,
      }));
    },
    [setViewport, canvasRef],
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onMouseLeave = useCallback(() => {
    dragRef.current = null;
    setMousePos(null);
  }, []);

  // ── Touch handlers (pinch zoom + pan) ────────────────────────────
  const touchRef = useRef<{
    startTouches: Array<{ x: number; y: number }>;
    startVp: ViewPort;
  } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touches = Array.from(e.touches).map((t) => ({
        x: t.clientX,
        y: t.clientY,
      }));
      touchRef.current = { startTouches: touches, startVp: { ...viewport } };
    },
    [viewport],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!touchRef.current) return;
      const { startTouches, startVp } = touchRef.current;

      if (e.touches.length === 1 && startTouches.length === 1) {
        // single-finger pan
        const dx = e.touches[0]!.clientX - startTouches[0]!.x;
        const dy = e.touches[0]!.clientY - startTouches[0]!.y;
        setViewport({
          ...startVp,
          centerX: startVp.centerX - dx / startVp.scaleX,
          centerY: startVp.centerY + dy / startVp.scaleY,
        });
      } else if (e.touches.length === 2 && startTouches.length >= 2) {
        // pinch zoom
        const d0 = Math.hypot(
          startTouches[1]!.x - startTouches[0]!.x,
          startTouches[1]!.y - startTouches[0]!.y,
        );
        const d1 = Math.hypot(
          e.touches[1]!.clientX - e.touches[0]!.clientX,
          e.touches[1]!.clientY - e.touches[0]!.clientY,
        );
        const ratio = d1 / d0;
        setViewport({
          ...startVp,
          scaleX: Math.max(1, Math.min(10000, startVp.scaleX * ratio)),
          scaleY: Math.max(1, Math.min(10000, startVp.scaleY * ratio)),
        });
      }
    },
    [setViewport],
  );

  const onTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="absolute inset-0 cursor-crosshair"
        style={{ width: size.w, height: size.h }}
      />
    </div>
  );
}

// ── Draw a single curve ──────────────────────────────────────────────

function drawCurve(
  ctx: CanvasRenderingContext2D,
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  canvasW: number,
  canvasH: number,
  vp: ViewPort,
  color: string,
  lineWidth: number,
  dash?: number[],
) {
  const steps = Math.max(canvasW, 400);
  const dx = (xMax - xMin) / steps;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (dash) ctx.setLineDash(dash);
  else ctx.setLineDash([]);

  let penDown = false;
  ctx.beginPath();

  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    let y: number;
    try {
      y = fn(x);
    } catch {
      penDown = false;
      continue;
    }

    if (!isFinite(y) || isNaN(y)) {
      penDown = false;
      continue;
    }

    const [sx, sy] = worldToScreen(x, y, vp, canvasW, canvasH);

    // clamp huge values to avoid canvas render artifacts
    const clampedSy = Math.max(-5000, Math.min(canvasH + 5000, sy));

    if (!penDown) {
      ctx.moveTo(sx, clampedSy);
      penDown = true;
    } else {
      ctx.lineTo(sx, clampedSy);
    }
  }

  ctx.stroke();
  ctx.setLineDash([]);
}

function worldToScreen(
  wx: number,
  wy: number,
  vp: ViewPort,
  w: number,
  h: number,
): [number, number] {
  const sx = w / 2 + (wx - vp.centerX) * vp.scaleX;
  const sy = h / 2 - (wy - vp.centerY) * vp.scaleY;
  return [sx, sy];
}

function screenToWorld(
  sx: number,
  sy: number,
  vp: ViewPort,
  w: number,
  h: number,
): [number, number] {
  const wx = (sx - w / 2) / vp.scaleX + vp.centerX;
  const wy = -(sy - h / 2) / vp.scaleY + vp.centerY;
  return [wx, wy];
}
