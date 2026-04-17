"use client";
import { motion } from "framer-motion";
import { RANKS, SUITS } from "@/lib/cards";

const SUIT_GLYPH = { c: "♣", d: "♦", h: "♥", s: "♠" } as const;

export function PlayingCard({
  card,
  size = "md",
  onClick,
  dim = false,
}: {
  card?: number | null;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  dim?: boolean;
}) {
  const w = size === "sm" ? 34 : size === "lg" ? 60 : 44;
  const h = size === "sm" ? 48 : size === "lg" ? 82 : 62;
  const font = size === "sm" ? 13 : size === "lg" ? 22 : 17;
  const sub = size === "sm" ? 11 : size === "lg" ? 18 : 14;

  if (card == null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="card-face grid place-items-center text-ink-300"
        style={{ width: w, height: h, borderStyle: "dashed" }}
        aria-label="pick card"
      >
        <span style={{ fontSize: sub }}>+</span>
      </button>
    );
  }

  const rank = (card >>> 2) & 0xf;
  const suit = card & 3;
  const glyph = SUIT_GLYPH[SUITS[suit] as keyof typeof SUIT_GLYPH];
  const suitClass =
    suit === 0 ? "suit-c" : suit === 1 ? "suit-d" : suit === 2 ? "suit-h" : "suit-s";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`card-face relative grid place-items-center ${dim ? "opacity-50" : ""}`}
      style={{ width: w, height: h }}
    >
      <span className="flex items-baseline gap-1">
        <span style={{ fontSize: font }} className="font-semibold tabular-nums">
          {RANKS[rank]}
        </span>
        <span style={{ fontSize: sub }} className={suitClass}>
          {glyph}
        </span>
      </span>
    </motion.button>
  );
}
