"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { RANKS, SUITS, cardStr, makeCard, parseCard } from "@/lib/cards";

const SUIT_GLYPH = { c: "♣", d: "♦", h: "♥", s: "♠" } as const;

export function BoardPicker({
  board,
  onChange,
}: {
  board: (number | null)[];
  onChange: (b: (number | null)[]) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [text, setText] = useState<string>(() => boardToText(board));
  const [textError, setTextError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Keep text in sync when the board changes from outside (picker clicks)
  useEffect(() => {
    setText(boardToText(board));
    setTextError(null);
  }, [board]);

  const used = new Set<number>();
  for (const c of board) if (c != null) used.add(c);

  function applyText(raw: string) {
    const cleaned = raw.replace(/[\s,]+/g, "");
    if (cleaned.length === 0) {
      onChange([null, null, null, null, null]);
      setTextError(null);
      return;
    }
    if (cleaned.length % 2 !== 0) {
      setTextError("Each card is 2 chars: rank + suit (e.g. Kd, Qh, 2c)");
      return;
    }
    const next: (number | null)[] = [null, null, null, null, null];
    const seen = new Set<number>();
    try {
      for (let i = 0, j = 0; i < cleaned.length; i += 2, j++) {
        if (j >= 5) {
          setTextError("Board is at most 5 cards");
          return;
        }
        const c = parseCard(cleaned.slice(i, i + 2));
        if (seen.has(c)) {
          setTextError(`Duplicate card: ${cleaned.slice(i, i + 2)}`);
          return;
        }
        seen.add(c);
        next[j] = c;
      }
      setTextError(null);
      onChange(next);
    } catch (e: any) {
      setTextError(e?.message ?? "bad card");
    }
  }

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

      <div>
        <div className="flex items-center gap-2 relative">
          <input
            type="text"
            className="input !h-8 flex-1 text-[13px] font-mono tracking-wider"
            placeholder="Type cards: e.g. Kd Qh 2c"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => applyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyText((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="syntax help"
            className="grid place-items-center h-8 w-8 rounded-md border border-ink-200 text-ink-500 hover:text-ink-900 hover:border-ink-700 transition-colors"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 7.2v.1M8.4 9c0-1 .8-1.8 1.8-1.8s1.8.7 1.8 1.6c0 1.6-2 1.6-2 3.3" strokeLinecap="round" />
              <circle cx="10" cy="14" r="0.6" fill="currentColor" />
            </svg>
          </button>
          <AnimatePresence>
            {showHelp && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-[calc(100%+6px)] z-20 w-80 section !p-3 text-[12px] text-ink-700 shadow-soft"
              >
                <div className="font-semibold text-ink-900 mb-1.5">Card syntax</div>
                <div className="space-y-1">
                  <div>
                    <span className="font-mono">Rank</span>
                    {" · "}
                    <span className="text-ink-500">
                      A K Q J T 9 8 7 6 5 4 3 2
                    </span>
                  </div>
                  <div>
                    <span className="font-mono">Suit</span>
                    {" · "}
                    <span className="suit-s">s♠</span>{" "}
                    <span className="suit-h">h♥</span>{" "}
                    <span className="suit-d">d♦</span>{" "}
                    <span className="suit-c">c♣</span>
                  </div>
                  <div className="text-ink-500 pt-1">
                    Examples: <span className="font-mono text-ink-900">Kd Qh 2c</span>,{" "}
                    <span className="font-mono text-ink-900">AsKsQs</span>,{" "}
                    <span className="font-mono text-ink-900">Td9d8d7c</span>
                  </div>
                  <div className="text-ink-500">
                    Spaces and commas are ignored. 3–5 cards.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {textError && (
          <div className="text-[11px] text-red-600 mt-1 font-mono">{textError}</div>
        )}
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

function boardToText(board: (number | null)[]): string {
  return board.filter((c): c is number => c != null).map(cardStr).join(" ");
}
