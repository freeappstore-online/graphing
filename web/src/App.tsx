import { useRef, useCallback, useState } from "react";
import GraphCanvas from "./GraphCanvas";
import Sidebar from "./Sidebar";
import TableView from "./TableView";
import { useGraphState } from "./useGraphState";

export default function App() {
  const {
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
  } = useGraphState();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleExportPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // fallback: download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "graph.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--paper)" }}>
      {/* Sidebar */}
      <Sidebar
        slots={slots}
        updateSlot={updateSlot}
        addSlot={addSlot}
        removeSlot={removeSlot}
        loadPreset={loadPreset}
        showTable={showTable}
        setShowTable={setShowTable}
        traceEnabled={traceEnabled}
        setTraceEnabled={setTraceEnabled}
        showIntersections={showIntersections}
        setShowIntersections={setShowIntersections}
        resetView={resetView}
        onExportPng={handleExportPng}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Canvas */}
        <GraphCanvas
          slots={slots}
          viewport={viewport}
          setViewport={setViewport}
          getCompiled={getCompiled}
          traceEnabled={traceEnabled}
          showIntersections={showIntersections}
          canvasRef={canvasRef}
        />

        {/* Table view */}
        {showTable && (
          <TableView
            slots={slots}
            viewport={viewport}
            getCompiled={getCompiled}
          />
        )}

        {/* Copy feedback toast */}
        {copyFeedback && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
            style={{
              background: "var(--success)",
              color: "#ffffff",
            }}
          >
            Copied PNG to clipboard
          </div>
        )}
      </div>
    </div>
  );
}
