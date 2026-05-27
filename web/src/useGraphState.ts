import { useState, useCallback, useRef } from "react";
import type { FunctionSlot, ViewPort } from "./types";
import { GRAPH_COLORS } from "./types";
import { compile, ParseError } from "./parser";
import type { CompiledFn } from "./parser";

let nextId = 1;

function makeSlot(expr = "", colorIndex = 0): FunctionSlot {
  return {
    id: String(nextId++),
    expr,
    color: GRAPH_COLORS[colorIndex % GRAPH_COLORS.length]!,
    visible: true,
    error: null,
    showDerivative: false,
  };
}

export function useGraphState() {
  const [slots, setSlots] = useState<FunctionSlot[]>([makeSlot("x^2", 0)]);
  const [viewport, setViewport] = useState<ViewPort>({
    centerX: 0,
    centerY: 0,
    scaleX: 60,
    scaleY: 60,
  });
  const [showTable, setShowTable] = useState(false);
  const [traceEnabled, setTraceEnabled] = useState(true);
  const [showIntersections, setShowIntersections] = useState(false);

  // cache compiled functions keyed by expression string
  const compiledCache = useRef(new Map<string, CompiledFn | null>());

  const getCompiled = useCallback((expr: string): CompiledFn | null => {
    if (!expr.trim()) return null;
    const cached = compiledCache.current.get(expr);
    if (cached !== undefined) return cached;
    try {
      const result = compile(expr);
      compiledCache.current.set(expr, result);
      return result;
    } catch {
      compiledCache.current.set(expr, null);
      return null;
    }
  }, []);

  const updateSlot = useCallback(
    (id: string, patch: Partial<FunctionSlot>) => {
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const updated = { ...s, ...patch };

          // re-parse if expression changed
          if ("expr" in patch) {
            compiledCache.current.delete(s.expr);
            const expr = updated.expr.trim();
            if (!expr) {
              updated.error = null;
            } else {
              try {
                compile(expr);
                updated.error = null;
              } catch (e) {
                updated.error =
                  e instanceof ParseError ? e.message : "Invalid expression";
              }
            }
          }
          return updated;
        }),
      );
    },
    [],
  );

  const addSlot = useCallback(() => {
    setSlots((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, makeSlot("", prev.length)];
    });
  }, []);

  const removeSlot = useCallback((id: string) => {
    setSlots((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const loadPreset = useCallback((expr: string) => {
    setSlots((prev) => {
      // find first empty slot or add new
      const emptyIdx = prev.findIndex((s) => !s.expr.trim());
      if (emptyIdx >= 0) {
        return prev.map((s, i) => {
          if (i !== emptyIdx) return s;
          const updated: FunctionSlot = { ...s, expr, error: null };
          try {
            compile(expr);
          } catch (e) {
            updated.error =
              e instanceof ParseError ? e.message : "Invalid expression";
          }
          return updated;
        });
      }
      if (prev.length >= 10) return prev;
      const slot = makeSlot(expr, prev.length);
      try {
        compile(expr);
      } catch (e) {
        slot.error =
          e instanceof ParseError ? e.message : "Invalid expression";
      }
      return [...prev, slot];
    });
  }, []);

  const resetView = useCallback(() => {
    setViewport({ centerX: 0, centerY: 0, scaleX: 60, scaleY: 60 });
  }, []);

  return {
    slots,
    viewport,
    setViewport,
    showTable,
    setShowTable,
    traceEnabled,
    setTraceEnabled,
    showIntersections,
    setShowIntersections,
    getCompiled,
    updateSlot,
    addSlot,
    removeSlot,
    loadPreset,
    resetView,
  };
}
