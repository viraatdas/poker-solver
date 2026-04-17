"use client";
import { motion } from "framer-motion";
import type { BetSizing } from "@/lib/solver/types";

function Chips({
  values,
  onChange,
}: {
  values: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <motion.div
          key={i}
          layout
          className="chip !bg-ink-900 !text-white"
        >
          <span>{Math.round(v * 100)}%</span>
          <button
            type="button"
            className="opacity-70 hover:opacity-100 ml-0.5"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            aria-label="remove"
          >
            ×
          </button>
        </motion.div>
      ))}
      <input
        type="text"
        placeholder="add % (e.g. 66)"
        className="chip border border-dashed border-ink-300 !bg-transparent outline-none w-24 placeholder:text-ink-400"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = parseFloat((e.target as HTMLInputElement).value);
            if (!isNaN(n) && n > 0) {
              onChange([...values, n / 100].sort((a, b) => a - b));
              (e.target as HTMLInputElement).value = "";
            }
          }
        }}
      />
    </div>
  );
}

export function BetSizingEditor({
  sizing,
  onChange,
}: {
  sizing: BetSizing;
  onChange: (s: BetSizing) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="field-label mb-1.5">Flop bets</div>
        <Chips values={sizing.flopBets} onChange={(flopBets) => onChange({ ...sizing, flopBets })} />
      </div>
      <div>
        <div className="field-label mb-1.5">Turn bets</div>
        <Chips values={sizing.turnBets} onChange={(turnBets) => onChange({ ...sizing, turnBets })} />
      </div>
      <div>
        <div className="field-label mb-1.5">River bets</div>
        <Chips values={sizing.riverBets} onChange={(riverBets) => onChange({ ...sizing, riverBets })} />
      </div>
      <div>
        <div className="field-label mb-1.5">Raise sizes</div>
        <Chips values={sizing.raiseSizes} onChange={(raiseSizes) => onChange({ ...sizing, raiseSizes })} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="field-label mb-1">Max raises / street</div>
          <input
            type="number"
            min={1}
            max={4}
            value={sizing.maxRaisesPerStreet}
            onChange={(e) =>
              onChange({ ...sizing, maxRaisesPerStreet: Math.max(1, Math.min(4, parseInt(e.target.value || "1", 10))) })
            }
            className="input !h-8 w-20"
          />
        </div>
      </div>
    </div>
  );
}
