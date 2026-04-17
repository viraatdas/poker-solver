"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardPicker } from "./BoardPicker";
import { RangeGrid } from "./RangeGrid";
import { BetSizingEditor } from "./BetSizingEditor";
import { StrategyView } from "./StrategyView";
import { Trainer } from "./Trainer";
import { cardStr } from "@/lib/cards";
import { emptyGrid, gridToWeights, parseRangeText, type Grid } from "@/lib/ranges";
import type { BetSizing, SolveResult } from "@/lib/solver/types";

const DEFAULT_SIZING: BetSizing = {
  flopBets: [0.33, 0.75],
  turnBets: [0.66],
  riverBets: [0.66, 1.5],
  raiseSizes: [1.0],
  maxRaisesPerStreet: 2,
  allinThreshold: 0.5,
};

export default function Solver() {
  const [oopGrid, setOopGrid] = useState<Grid>(() => parseRangeText("JJ+,AQs+,AJo+,KQo,KQs,KJs,QJs,JTs,T9s,98s"));
  const [ipGrid, setIpGrid] = useState<Grid>(() => parseRangeText("TT-88,AJs-A8s,KTs+,QTs+,J9s+,T9s,A5s-A2s,AJo,KJo+,AQo-ATo"));
  const [board, setBoard] = useState<(number | null)[]>(() => [
    // Ks Qh 2d
    11 * 4 + 3,
    10 * 4 + 2,
    0 * 4 + 1,
    null,
    null,
  ]);
  const [pot, setPot] = useState<number>(20);
  const [stack, setStack] = useState<number>(180);
  const [iterations, setIterations] = useState<number>(300);
  const [sizing, setSizing] = useState<BetSizing>(DEFAULT_SIZING);

  const [activeRange, setActiveRange] = useState<"oop" | "ip">("oop");
  const [rangeText, setRangeText] = useState<string>("");

  const [progress, setProgress] = useState<{ iter: number; total: number; evOop: number; evIp: number } | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"strategy" | "trainer">("strategy");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../workers/solver.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.type === "progress") setProgress(msg.data);
      else if (msg.type === "done") {
        setResult(hydrateResult(msg.data));
        setRunning(false);
      } else if (msg.type === "error") {
        setError(msg.message);
        setRunning(false);
      }
    };
    return () => w.terminate();
  }, []);

  const boardReady = board.slice(0, 3).every((c) => c != null);
  const activeGrid = activeRange === "oop" ? oopGrid : ipGrid;
  const setActiveGrid = activeRange === "oop" ? setOopGrid : setIpGrid;

  const run = useCallback(() => {
    if (!workerRef.current || !boardReady) return;
    setError(null);
    setProgress(null);
    setResult(null);
    setRunning(true);
    const boardCards = (board.filter((c) => c != null) as number[]);
    const input = {
      rangeOop: gridToWeights(oopGrid),
      rangeIp: gridToWeights(ipGrid),
      board: boardCards,
      pot,
      effectiveStack: stack,
      sizing,
      iterations,
    };
    workerRef.current.postMessage({ type: "solve", input: serializeInput(input) });
  }, [oopGrid, ipGrid, board, pot, stack, sizing, iterations, boardReady]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: "stop" });
  }, []);

  const applyRangeText = () => {
    const trimmed = rangeText.trim();
    if (!trimmed) return;
    try {
      const g = parseRangeText(trimmed);
      if (activeRange === "oop") setOopGrid(g);
      else setIpGrid(g);
    } catch (e: any) {
      setError(e?.message ?? "parse error");
    }
  };

  return (
    <div className="grid grid-cols-[420px_1fr] gap-6">
      <div className="space-y-4">
        <div className="section">
          <div className="flex items-center justify-between mb-3">
            <div className="field-label">Board</div>
            <div className="text-[11px] text-ink-500 font-mono">
              {board.filter((c) => c != null).map((c) => cardStr(c as number)).join(" ") || "—"}
            </div>
          </div>
          <BoardPicker board={board} onChange={setBoard} />
        </div>

        <div className="section">
          <div className="flex items-center gap-2 mb-3">
            <div className="field-label">Ranges</div>
            <div className="flex-1" />
            <div className="inline-flex rounded-lg bg-ink-100 p-0.5">
              {(["oop", "ip"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveRange(k)}
                  className={`px-3 h-7 text-[12px] rounded-md font-medium transition-colors ${
                    activeRange === k ? "bg-white shadow-soft text-ink-900" : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <RangeGrid grid={activeGrid} onChange={setActiveGrid} />
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              placeholder='e.g. "JJ+, AQs+, AKo"'
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyRangeText()}
              className="input !h-8 flex-1 text-[12px] font-mono"
            />
            <button type="button" className="btn btn-ghost h-8" onClick={applyRangeText}>
              Apply
            </button>
            <button
              type="button"
              className="btn btn-ghost h-8"
              onClick={() => {
                if (activeRange === "oop") setOopGrid(emptyGrid());
                else setIpGrid(emptyGrid());
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="section">
          <div className="field-label mb-3">Stacks & pot</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Pot">
              <input
                type="number"
                min={0}
                value={pot}
                onChange={(e) => setPot(Math.max(0, parseFloat(e.target.value) || 0))}
                className="input !h-8"
              />
            </Field>
            <Field label="Effective Stack">
              <input
                type="number"
                min={0}
                value={stack}
                onChange={(e) => setStack(Math.max(0, parseFloat(e.target.value) || 0))}
                className="input !h-8"
              />
            </Field>
            <Field label="Iterations">
              <input
                type="number"
                min={10}
                max={5000}
                step={10}
                value={iterations}
                onChange={(e) => setIterations(Math.max(10, parseInt(e.target.value || "10", 10)))}
                className="input !h-8"
              />
            </Field>
          </div>
        </div>

        <div className="section">
          <div className="field-label mb-3">Bet sizes</div>
          <BetSizingEditor sizing={sizing} onChange={setSizing} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={running || !boardReady}
            className="btn btn-primary flex-1 h-10 text-sm"
          >
            {running ? `Solving…` : "Solve"}
          </button>
          {running && (
            <button type="button" onClick={stop} className="btn btn-ghost h-10">
              Stop
            </button>
          )}
        </div>
        <AnimatePresence>
          {progress && running && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="section !py-2 !px-3"
            >
              <div className="flex items-center justify-between text-[11px] text-ink-500">
                <span>
                  iter {progress.iter}/{progress.total}
                </span>
                <span className="num">
                  EV: oop {progress.evOop.toFixed(2)}, ip {progress.evIp.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-ink-100 overflow-hidden">
                <motion.div
                  className="h-full bg-ink-900"
                  animate={{ width: `${(progress.iter / progress.total) * 100}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <div className="text-[12px] text-red-600 font-mono">{error}</div>}
      </div>

      <div>
        {!result && !running && (
          <div className="section grid place-items-center py-24 text-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-ink-400">Waiting</div>
              <div className="text-ink-700 font-medium mt-2">Configure inputs and press Solve.</div>
              <div className="text-ink-500 text-sm mt-1">
                CFR+ runs in a web worker. Start with ~300 iters; bump for tighter convergence.
              </div>
            </div>
          </div>
        )}
        {running && !result && (
          <div className="section grid place-items-center py-24">
            <div className="text-ink-500 text-sm">Solving…</div>
          </div>
        )}
        {result && (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg bg-ink-100 p-0.5">
              {(["strategy", "trainer"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`px-3 h-7 text-[12px] rounded-md font-medium transition-colors ${
                    tab === k ? "bg-white shadow-soft text-ink-900" : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  {k === "strategy" ? "Strategy" : "Trainer"}
                </button>
              ))}
            </div>
            {tab === "strategy" ? (
              <StrategyView
                strategies={result.strategies}
                rootEv={result.rootEv}
                iterations={result.iterations}
              />
            ) : (
              <Trainer
                strategies={result.strategies}
                rangeOop={gridToWeights(oopGrid)}
                rangeIp={gridToWeights(ipGrid)}
                board={(board.filter((c) => c != null) as number[])}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="field-label mb-1">{label}</div>
      {children}
    </label>
  );
}

// ---- Worker serialization helpers ----

function serializeInput(input: any) {
  return {
    ...input,
    rangeOop: Array.from(input.rangeOop as Float32Array),
    rangeIp: Array.from(input.rangeIp as Float32Array),
  };
}

function hydrateResult(raw: any): SolveResult {
  return {
    iterations: raw.iterations,
    rootEv: raw.rootEv,
    strategies: raw.strategies.map((s: any) => ({
      ...s,
      perCombo: new Float32Array(s.perCombo),
    })),
  };
}
