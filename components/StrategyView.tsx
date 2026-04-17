"use client";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Action, NodeStrategy } from "@/lib/solver/types";

const actionLabel = (a: Action) => {
  switch (a.kind) {
    case "fold": return "Fold";
    case "check": return "Check";
    case "call": return "Call";
    case "bet": return `Bet ${a.amount.toFixed(1)}`;
    case "raise": return `Raise to ${a.amount.toFixed(1)}`;
    case "allin": return "All-in";
  }
};

const actionColor = (a: Action) => {
  switch (a.kind) {
    case "fold": return "#9a9a9a";
    case "check":
    case "call": return "#2a2a2a";
    case "bet": return "#0a0a0a";
    case "raise": return "#404040";
    case "allin": return "#6b6b6b";
  }
};

export function StrategyView({
  strategies,
  rootEv,
  iterations,
}: {
  strategies: NodeStrategy[];
  rootEv: [number, number];
  iterations: number;
}) {
  const [selected, setSelected] = useState<string>("/");
  const strat = strategies.find((s) => s.path === selected) ?? strategies[0];

  const tree = useMemo(() => {
    // Simple list grouped by depth
    const sorted = strategies.slice().sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
    return sorted;
  }, [strategies]);

  if (!strat) return <div className="text-ink-500 text-sm">No strategy.</div>;

  return (
    <div className="grid grid-cols-[220px_1fr] gap-5">
      <nav className="section !p-2">
        <div className="field-label px-2 pt-1 pb-2">Decision path</div>
        <ul className="space-y-0.5">
          {tree.map((s) => {
            const depth = (s.path.match(/\//g)?.length ?? 1) - 1;
            const label = s.path === "/" ? "Root" : s.path.split("/").filter(Boolean).pop();
            const isSel = s.path === selected;
            return (
              <li key={s.path}>
                <button
                  type="button"
                  onClick={() => setSelected(s.path)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors flex items-center gap-2 ${
                    isSel ? "bg-ink-900 text-white" : "hover:bg-ink-100 text-ink-700"
                  }`}
                  style={{ paddingLeft: 10 + depth * 10 }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${s.player === 0 ? "bg-white/80" : ""} ${isSel ? "" : s.player === 0 ? "!bg-ink-900" : "!bg-ink-500"}`} />
                  <span className="font-mono">{label || "/"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="chip">{strat.player === 0 ? "OOP" : "IP"}</span>
          <span className="chip num">pot {strat.pot.toFixed(2)}</span>
          <span className="chip num">oop in {strat.invested[0].toFixed(2)}</span>
          <span className="chip num">ip in {strat.invested[1].toFixed(2)}</span>
          <span className="chip num">{iterations} iters</span>
          <div className="flex-1" />
          <span className="chip num">EV OOP {rootEv[0].toFixed(2)}</span>
          <span className="chip num">EV IP {rootEv[1].toFixed(2)}</span>
        </div>

        <div className="section">
          <div className="field-label mb-2">Overall action frequencies</div>
          <div className="space-y-2">
            {strat.actions.map((a, i) => {
              const f = strat.overallFreq[i] ?? 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 text-[13px]">{actionLabel(a)}</div>
                  <div className="flex-1 h-6 rounded-md bg-ink-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${f * 100}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      style={{ background: actionColor(a), height: "100%" }}
                    />
                  </div>
                  <div className="w-12 text-right text-[12px] num tabular-nums">{(f * 100).toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="section">
          <div className="field-label mb-2">Per-hand strategy heatmap</div>
          <StrategyHeatmap strat={strat} />
        </div>
      </div>
    </div>
  );
}

function StrategyHeatmap({ strat }: { strat: NodeStrategy }) {
  // Render 13x13 grid; each cell: compute aggregated strategy mix for that hand class.
  // For each cell we average over its combos (using raw weights of 1 per combo for aesthetic uniformity).
  const { rows, cellActions } = useMemo(() => buildCellMix(strat), [strat]);

  const colorFor = (mix: number[]) => {
    const colors = strat.actions.map(actionColor);
    // Build CSS gradient stacked
    let acc = 0;
    const stops: string[] = [];
    for (let i = 0; i < mix.length; i++) {
      const frac = mix[i];
      if (frac <= 0.001) continue;
      stops.push(`${colors[i]} ${(acc * 100).toFixed(1)}%`);
      acc += frac;
      stops.push(`${colors[i]} ${(acc * 100).toFixed(1)}%`);
    }
    if (stops.length === 0) return "#f4f4f4";
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  };

  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
    >
      {rows.map((cellMix, idx) => {
        const total = cellMix.reduce((a, b) => a + b, 0);
        const label = HAND_LABELS[idx];
        const hasData = total > 0.001;
        return (
          <div
            key={idx}
            className={`relative h-7 rounded-[3px] border text-[10px] overflow-hidden ${hasData ? "border-ink-700" : "border-ink-200"}`}
            style={{ background: hasData ? colorFor(cellMix.map((x) => x / total)) : "#f4f4f4" }}
          >
            <span
              className={`absolute inset-0 grid place-items-center font-semibold tabular-nums ${hasData ? "text-white" : "text-ink-400"}`}
              style={{ textShadow: hasData ? "0 1px 0 rgba(0,0,0,0.25)" : undefined }}
            >
              {label}
            </span>
          </div>
        );
      })}
      {/* legend */}
      <div className="mt-2 flex flex-wrap gap-2" style={{ gridColumn: "1 / -1" }}>
        {strat.actions.map((a, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-ink-600">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: actionColor(a) }} />
            {actionLabel(a)}
          </div>
        ))}
      </div>
      {/* Keeping the `cellActions` variable in scope for TS. */}
      <span style={{ display: "none" }}>{cellActions}</span>
    </div>
  );
}

const HAND_LABELS: string[] = (() => {
  const RANKS = "AKQJT98765432";
  const out: string[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const r = RANKS[row], c = RANKS[col];
      if (row === col) out.push(r + r);
      else if (row < col) out.push(r + c + "s");
      else out.push(c + r + "o");
    }
  }
  return out;
})();

function buildCellMix(strat: NodeStrategy): { rows: number[][]; cellActions: number } {
  // For each hand class (169), average over its combos' strategy vectors
  const n = strat.actions.length;
  const rows: number[][] = Array.from({ length: 169 }, () => Array(n).fill(0));
  const counts = new Array(169).fill(0);

  const comboFromIndex = (idx: number) => {
    let hi = 1;
    while ((hi * (hi - 1)) / 2 <= idx) hi++;
    hi--;
    const lo = idx - (hi * (hi - 1)) / 2;
    return [hi, lo] as const;
  };

  for (let c = 0; c < 1326; c++) {
    const [a, b] = comboFromIndex(c);
    const rA = a >>> 2, rB = b >>> 2;
    const sA = a & 3, sB = b & 3;
    const hi = rA > rB ? rA : rB;
    const lo = rA > rB ? rB : rA;
    let cellIdx: number;
    if (hi === lo) {
      cellIdx = (12 - hi) * 13 + (12 - hi);
    } else if (sA === sB) {
      // suited: row = 12 - hi, col = 12 - lo, with row < col
      cellIdx = (12 - hi) * 13 + (12 - lo);
    } else {
      // offsuit: row = 12 - lo, col = 12 - hi, with row > col
      cellIdx = (12 - lo) * 13 + (12 - hi);
    }
    counts[cellIdx]++;
    const base = c * n;
    for (let i = 0; i < n; i++) rows[cellIdx][i] += strat.perCombo[base + i];
  }
  for (let i = 0; i < 169; i++) {
    const k = counts[i];
    if (k > 0) for (let j = 0; j < n; j++) rows[i][j] /= k;
  }
  return { rows, cellActions: n };
}
