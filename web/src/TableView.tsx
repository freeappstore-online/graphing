import { useMemo } from "react";
import type { FunctionSlot, ViewPort } from "./types";
import type { CompiledFn } from "./parser";

interface Props {
  slots: FunctionSlot[];
  viewport: ViewPort;
  getCompiled: (expr: string) => CompiledFn | null;
}

export default function TableView({ slots, viewport, getCompiled }: Props) {
  const activeSlots = useMemo(
    () =>
      slots.filter((s) => s.visible && s.expr.trim() && !s.error),
    [slots],
  );

  const tableData = useMemo(() => {
    // generate x values centered around viewport center
    const xCenter = viewport.centerX;
    const xRange = 10 / (viewport.scaleX / 60); // adaptive range
    const step = xRange / 10;
    const rows: Array<{ x: number; values: Array<number | null> }> = [];

    for (let i = -10; i <= 10; i++) {
      const x = Math.round((xCenter + i * step) * 1000) / 1000;
      const values = activeSlots.map((slot) => {
        const compiled = getCompiled(slot.expr);
        if (!compiled) return null;
        try {
          const y = compiled.fn(x);
          return isFinite(y) ? Math.round(y * 100000) / 100000 : null;
        } catch {
          return null;
        }
      });
      rows.push({ x, values });
    }

    return rows;
  }, [activeSlots, viewport.centerX, viewport.scaleX, getCompiled]);

  if (activeSlots.length === 0) {
    return (
      <div
        className="p-4 text-sm"
        style={{ color: "var(--muted)", background: "var(--panel)" }}
      >
        Enter a function to see the table.
      </div>
    );
  }

  return (
    <div
      className="overflow-auto border-t"
      style={{
        maxHeight: 220,
        background: "var(--panel)",
        borderColor: "var(--line)",
      }}
    >
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              className="sticky top-0 px-3 py-1.5 text-left font-semibold"
              style={{
                background: "var(--panel)",
                color: "var(--muted)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              x
            </th>
            {activeSlots.map((slot) => (
              <th
                key={slot.id}
                className="sticky top-0 px-3 py-1.5 text-right font-semibold"
                style={{
                  background: "var(--panel)",
                  color: slot.color,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {slot.expr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, ri) => (
            <tr key={ri}>
              <td
                className="px-3 py-1 font-mono"
                style={{
                  color: "var(--ink)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {row.x}
              </td>
              {row.values.map((v, vi) => (
                <td
                  key={vi}
                  className="px-3 py-1 text-right font-mono"
                  style={{
                    color: v === null ? "var(--muted)" : "var(--ink)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {v === null ? "--" : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
