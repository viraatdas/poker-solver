"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { COMBO_COUNT, cardStr, comboFromIndex } from "@/lib/cards";
import type { Weights } from "@/lib/ranges";
import type { Action, NodeStrategy } from "@/lib/solver/types";

type Score = {
  combo: [number, number];
  chosen: number;
  probChosen: number;
  mix: number[];
  actions: Action[];
  path: string;
  player: 0 | 1;
};

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

export function Trainer({
  strategies,
  rangeOop,
  rangeIp,
  board,
}: {
  strategies: NodeStrategy[];
  rangeOop: Weights;
  rangeIp: Weights;
  board: number[];
}) {
  const [selectedPath, setSelectedPath] = useState<string>("/");
  const [current, setCurrent] = useState<{ combo: [number, number]; idx: number } | null>(null);
  const [revealed, setRevealed] = useState<Score | null>(null);
  const [history, setHistory] = useState<Score[]>([]);

  const strat = strategies.find((s) => s.path === selectedPath) ?? strategies[0];
  const range = strat.player === 0 ? rangeOop : rangeIp;

  const validCombos = useMemo(() => {
    const boardMask = board.reduce((m, c) => m | (1 << c), 0);
    const out: { idx: number; combo: [number, number]; w: number }[] = [];
    for (let i = 0; i < COMBO_COUNT; i++) {
      const w = range[i];
      if (w <= 0) continue;
      const [a, b] = comboFromIndex(i);
      if (((boardMask >> a) & 1) || ((boardMask >> b) & 1)) continue;
      out.push({ idx: i, combo: [a, b], w });
    }
    return out;
  }, [range, board]);

  function sample() {
    if (validCombos.length === 0) return;
    let total = 0;
    for (const c of validCombos) total += c.w;
    let r = Math.random() * total;
    let pick = validCombos[validCombos.length - 1];
    for (const c of validCombos) {
      r -= c.w;
      if (r <= 0) { pick = c; break; }
    }
    setCurrent({ combo: pick.combo, idx: pick.idx });
    setRevealed(null);
  }

  function choose(actionIdx: number) {
    if (!current) return;
    const n = strat.actions.length;
    const base = current.idx * n;
    const mix = Array.from(strat.perCombo.subarray(base, base + n));
    const score: Score = {
      combo: current.combo,
      chosen: actionIdx,
      probChosen: mix[actionIdx] ?? 0,
      mix,
      actions: strat.actions.slice(),
      path: selectedPath,
      player: strat.player,
    };
    setHistory((h) => [score, ...h].slice(0, 12));
    setRevealed(score);
  }

  function next() {
    sample();
  }

  const stats = useMemo(() => {
    if (history.length === 0) return { accuracy: 0, n: 0 };
    const sum = history.reduce((a, s) => a + s.probChosen, 0);
    return { accuracy: sum / history.length, n: history.length };
  }, [history]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">{strat.player === 0 ? "OOP to act" : "IP to act"}</span>
        <select
          className="input !h-8 !w-auto text-[12px] font-mono"
          value={selectedPath}
          onChange={(e) => {
            setSelectedPath(e.target.value);
            setCurrent(null);
            setRevealed(null);
            setHistory([]);
          }}
        >
          {strategies.map((s) => (
            <option key={s.path} value={s.path}>
              {s.path === "/" ? "/ (root)" : s.path} — {s.player === 0 ? "OOP" : "IP"}
            </option>
          ))}
        </select>
        <span className="chip num">pot {strat.pot.toFixed(2)}</span>
        <div className="flex-1" />
        <span className="chip">{stats.n} hands</span>
        <span className="chip num">
          accuracy {Math.round(stats.accuracy * 100)}%
        </span>
        <button type="button" className="btn btn-ghost h-8" onClick={() => setHistory([])}>
          Reset
        </button>
      </div>

      <div className="section">
        <div className="flex items-start gap-6">
          <div className="space-y-3">
            <div className="field-label">Your hand</div>
            {current ? (
              <div className="flex gap-2">
                <PlayingCard card={current.combo[0]} size="lg" />
                <PlayingCard card={current.combo[1]} size="lg" />
              </div>
            ) : (
              <div className="flex gap-2">
                <PlayingCard card={null} size="lg" />
                <PlayingCard card={null} size="lg" />
              </div>
            )}
          </div>
          <div className="w-px self-stretch bg-ink-200" />
          <div className="space-y-3">
            <div className="field-label">Board</div>
            <div className="flex gap-2">
              {board.map((c, i) => (
                <PlayingCard key={i} card={c} size="lg" />
              ))}
              {board.length < 5 &&
                Array.from({ length: 5 - board.length }, (_, i) => (
                  <PlayingCard key={`e${i}`} card={null} size="lg" />
                ))}
            </div>
          </div>
          <div className="flex-1" />
          {!current && (
            <button type="button" className="btn btn-primary h-10" onClick={sample}>
              Deal
            </button>
          )}
        </div>
      </div>

      {current && (
        <div className="section">
          <div className="field-label mb-3">Choose an action</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {strat.actions.map((a, i) => {
              const picked = revealed?.chosen === i;
              const prob = revealed?.mix[i] ?? 0;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!!revealed}
                  onClick={() => choose(i)}
                  className={`relative h-12 rounded-xl2 text-[13px] font-medium overflow-hidden border transition-all ${
                    picked
                      ? "border-ink-900"
                      : revealed
                      ? "border-ink-200 opacity-70"
                      : "border-ink-200 hover:border-ink-700 bg-white"
                  }`}
                >
                  {revealed && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${prob * 100}%` }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-y-0 left-0 bg-ink-100"
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-between px-3">
                    <span>{actionLabel(a)}</span>
                    {revealed ? (
                      <span className={`num tabular-nums text-[12px] ${prob >= 0.5 ? "text-ink-900 font-semibold" : "text-ink-600"}`}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-3"
              >
                <Verdict score={revealed} />
                <div className="flex-1" />
                <button type="button" className="btn btn-primary h-9" onClick={next}>
                  Next hand →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {history.length > 0 && (
        <div className="section">
          <div className="field-label mb-3">Recent</div>
          <ul className="space-y-1.5">
            {history.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-[12px]">
                <span className="font-mono tabular-nums w-16">
                  {cardStr(s.combo[0])}{cardStr(s.combo[1])}
                </span>
                <span className="text-ink-500 w-24 truncate">
                  {s.path === "/" ? "root" : s.path}
                </span>
                <span className="flex-1 truncate">{actionLabel(s.actions[s.chosen])}</span>
                <span
                  className={`w-12 text-right num tabular-nums ${
                    s.probChosen >= 0.5 ? "text-ink-900" : s.probChosen >= 0.2 ? "text-ink-600" : "text-red-600"
                  }`}
                >
                  {(s.probChosen * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Verdict({ score }: { score: Score }) {
  const p = score.probChosen;
  const best = Math.max(...score.mix);
  const label =
    p >= 0.5 ? "Solid"
    : p >= 0.25 ? "Acceptable"
    : p >= 0.05 ? "Off-mix"
    : "Mistake";
  const color =
    p >= 0.5 ? "text-ink-900"
    : p >= 0.25 ? "text-ink-700"
    : p >= 0.05 ? "text-amber-700"
    : "text-red-600";
  return (
    <div className={`text-[13px] font-medium ${color}`}>
      {label}
      <span className="text-ink-500 font-normal ml-2">
        you: {(p * 100).toFixed(0)}% · best in mix: {(best * 100).toFixed(0)}%
      </span>
    </div>
  );
}
