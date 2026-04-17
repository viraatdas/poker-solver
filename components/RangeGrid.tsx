"use client";
import { useRef, useState } from "react";
import { cellFromGrid, cellLabel, type Grid } from "@/lib/ranges";

export function RangeGrid({
  grid,
  onChange,
  highlight,
}: {
  grid: Grid;
  onChange: (g: Grid) => void;
  highlight?: Float32Array; // 13x13 heatmap values [0,1] — if present, dims editing
}) {
  const [paintValue, setPaintValue] = useState<number>(1);
  const dragging = useRef<null | { target: number }>(null);

  function setCell(row: number, col: number, value: number) {
    const next = grid.map((r) => r.slice());
    next[row][col] = value;
    onChange(next);
  }

  function cellStyle(row: number, col: number): React.CSSProperties {
    const { kind } = cellFromGrid(row, col);
    const base =
      kind === "pair" ? "#fafafa" : kind === "suited" ? "#f4f4f4" : "#ffffff";
    return { background: base };
  }

  function cellOverlay(row: number, col: number) {
    const v = grid[row][col];
    if (v <= 0) return null;
    return (
      <div
        className="absolute inset-0 rounded-[3px] pointer-events-none"
        style={{ background: `rgba(10,10,10,${0.1 + 0.8 * v})` }}
      />
    );
  }

  return (
    <div className="select-none">
      <div
        className="grid gap-[2px] rounded-xl2 border border-ink-200 p-1 bg-ink-50"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
        onMouseLeave={() => (dragging.current = null)}
      >
        {Array.from({ length: 13 }, (_, row) =>
          Array.from({ length: 13 }, (_, col) => {
            const v = grid[row][col];
            const label = cellLabel(row, col);
            const active = v > 0;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onMouseDown={(e) => {
                  const shift = e.shiftKey;
                  const target = shift ? (v > 0 ? 0 : 0.5) : v > 0 ? 0 : 1;
                  setPaintValue(target);
                  dragging.current = { target };
                  setCell(row, col, target);
                }}
                onMouseEnter={() => {
                  if (dragging.current) setCell(row, col, dragging.current.target);
                }}
                onMouseUp={() => (dragging.current = null)}
                className={`relative h-7 text-[10px] rounded-[3px] border transition-colors ${
                  active ? "border-ink-700" : "border-ink-200"
                }`}
                style={cellStyle(row, col)}
              >
                {cellOverlay(row, col)}
                <span
                  className={`relative z-10 font-semibold tabular-nums ${
                    active ? "text-white" : "text-ink-600"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          }),
        )}
      </div>
      <p className="text-[11px] text-ink-500 mt-2">
        Click to toggle. Drag to paint. Shift-click for 50% weight.
      </p>
    </div>
  );
}
