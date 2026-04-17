"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { RANKS, SUITS, makeCard } from "@/lib/cards";

const SUIT_GLYPH = { c: "♣", d: "♦", h: "♥", s: "♠" } as const;

export function BoardPicker({
  board,
  onChange,
}: {
  board: (number | null)[];
  onChange: (b: (number | null)[]) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const used = new Set<number>();
  for (const c of board) if (c != null) used.add(c);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <PlayingCard
              card={board[i]}
              size="lg"
              onClick={() => setOpen(open === i ? null : i)}
            />
            <span className="text-[10px] uppercase tracking-wider text-ink-400">
              {i < 3 ? "Flop" : i === 3 ? "Turn" : "River"}
            </span>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {open !== null && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="section"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="field-label">Select a card</span>
              <button
                type="button"
                className="btn btn-ghost h-7 px-2 text-xs"
                onClick={() => {
                  const next = board.slice();
                  next[open] = null;
                  onChange(next);
                  setOpen(null);
                }}
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-13 gap-1" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
              {Array.from({ length: 13 }, (_, rIdx) => 12 - rIdx).map((r) => (
                <div key={r} className="flex flex-col gap-1">
                  {[0, 1, 2, 3].map((s) => {
                    const c = makeCard(r, s);
                    const isUsed = used.has(c) && board[open] !== c;
                    const suitClass =
                      s === 0 ? "suit-c" : s === 1 ? "suit-d" : s === 2 ? "suit-h" : "suit-s";
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={isUsed}
                        onClick={() => {
                          const next = board.slice();
                          next[open] = c;
                          onChange(next);
                          setOpen(null);
                        }}
                        className={`h-7 rounded-md border text-[12px] transition-all ${
                          isUsed
                            ? "bg-ink-100 border-ink-200 text-ink-300 cursor-not-allowed"
                            : "bg-white border-ink-200 hover:border-ink-700 hover:bg-ink-50"
                        }`}
                      >
                        <span className="font-semibold tabular-nums">{RANKS[r]}</span>
                        <span className={`ml-0.5 ${suitClass}`}>
                          {SUIT_GLYPH[SUITS[s] as keyof typeof SUIT_GLYPH]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
