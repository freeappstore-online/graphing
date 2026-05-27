import type { FunctionSlot } from "./types";
import { PRESETS } from "./types";

interface Props {
  slots: FunctionSlot[];
  updateSlot: (id: string, patch: Partial<FunctionSlot>) => void;
  addSlot: () => void;
  removeSlot: (id: string) => void;
  loadPreset: (expr: string) => void;
  showTable: boolean;
  setShowTable: (v: boolean) => void;
  traceEnabled: boolean;
  setTraceEnabled: (v: boolean) => void;
  showIntersections: boolean;
  setShowIntersections: (v: boolean) => void;
  resetView: () => void;
  onExportPng: () => void;
}

export default function Sidebar({
  slots,
  updateSlot,
  addSlot,
  removeSlot,
  loadPreset,
  showTable,
  setShowTable,
  traceEnabled,
  setTraceEnabled,
  showIntersections,
  setShowIntersections,
  resetView,
  onExportPng,
}: Props) {
  return (
    <aside
      className="flex flex-col gap-4 overflow-y-auto border-r"
      style={{
        width: 320,
        minWidth: 280,
        background: "var(--panel)",
        borderColor: "var(--line)",
        padding: "16px",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1
          className="text-lg font-bold tracking-tight"
          style={{ fontFamily: "Fraunces, serif", color: "var(--ink)" }}
        >
          Graphing Calculator
        </h1>
      </div>

      {/* Function slots */}
      <div className="flex flex-col gap-2">
        <label
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)" }}
        >
          Functions (y = f(x))
        </label>
        {slots.map((slot) => (
          <FunctionInput
            key={slot.id}
            slot={slot}
            canRemove={slots.length > 1}
            onChange={(patch) => updateSlot(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
          />
        ))}
        {slots.length < 10 && (
          <button
            onClick={addSlot}
            className="text-sm font-medium rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            style={{
              color: "var(--accent)",
              border: "1px dashed var(--line-strong)",
              background: "transparent",
            }}
          >
            + Add function
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)" }}
        >
          Presets
        </label>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => loadPreset(p.expr)}
              className="text-xs px-2 py-1 rounded-md transition-colors cursor-pointer"
              style={{
                background: "var(--paper)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
              }}
              title={`y = ${p.expr}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-2">
        <label
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)" }}
        >
          Options
        </label>
        <Toggle
          label="Trace on hover"
          checked={traceEnabled}
          onChange={setTraceEnabled}
        />
        <Toggle
          label="Show intersections"
          checked={showIntersections}
          onChange={setShowIntersections}
        />
        <Toggle
          label="Show table"
          checked={showTable}
          onChange={setShowTable}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 mt-auto">
        <button
          onClick={resetView}
          className="text-sm font-medium rounded-lg px-3 py-2 transition-colors cursor-pointer"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          Reset view
        </button>
        <button
          onClick={onExportPng}
          className="text-sm font-medium rounded-lg px-3 py-2 transition-colors cursor-pointer"
          style={{
            background: "var(--accent)",
            color: "#ffffff",
            border: "none",
          }}
        >
          Copy as PNG
        </button>
      </div>
    </aside>
  );
}

// ── Function input row ───────────────────────────────────────────────

function FunctionInput({
  slot,
  canRemove,
  onChange,
  onRemove,
}: {
  slot: FunctionSlot;
  canRemove: boolean;
  onChange: (patch: Partial<FunctionSlot>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* Color swatch */}
        <button
          onClick={() => onChange({ visible: !slot.visible })}
          className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer border-0"
          style={{
            background: slot.visible ? slot.color : "var(--line)",
            opacity: slot.visible ? 1 : 0.4,
          }}
          title={slot.visible ? "Hide" : "Show"}
        />

        {/* Input */}
        <div className="flex-1 flex items-center gap-1">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--muted)" }}
          >
            y =
          </span>
          <input
            type="text"
            value={slot.expr}
            onChange={(e) => onChange({ expr: e.target.value })}
            placeholder="e.g. sin(x)"
            spellCheck={false}
            className="flex-1 text-sm px-2 py-1 rounded-md outline-none"
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              border: `1px solid ${slot.error ? "var(--error)" : "var(--line)"}`,
              fontFamily: "monospace",
            }}
          />
        </div>

        {/* Derivative toggle */}
        <button
          onClick={() => onChange({ showDerivative: !slot.showDerivative })}
          className="text-xs px-1.5 py-0.5 rounded cursor-pointer border-0"
          style={{
            background: slot.showDerivative ? slot.color : "transparent",
            color: slot.showDerivative ? "#ffffff" : "var(--muted)",
            border: `1px solid ${slot.showDerivative ? slot.color : "var(--line)"}`,
          }}
          title="Toggle derivative f'(x)"
        >
          f'
        </button>

        {/* Remove */}
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-sm cursor-pointer border-0 bg-transparent leading-none"
            style={{ color: "var(--muted)", padding: 2 }}
            title="Remove"
          >
            x
          </button>
        )}
      </div>
      {slot.error && (
        <span className="text-xs pl-7" style={{ color: "var(--error)" }}>
          {slot.error}
        </span>
      )}
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-2 text-sm cursor-pointer select-none"
      style={{ color: "var(--ink)" }}
    >
      <span
        className="relative inline-block rounded-full transition-colors"
        style={{
          width: 32,
          height: 18,
          background: checked ? "var(--accent)" : "var(--line-strong)",
        }}
      >
        <span
          className="absolute top-0.5 rounded-full transition-all"
          style={{
            width: 14,
            height: 14,
            left: checked ? 15 : 3,
            background: "#ffffff",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
