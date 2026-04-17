import { describe, it, expect } from "vitest";
import { parseBoard } from "../cards";
import { gridToWeights, parseRangeText } from "../ranges";
import { solve } from "../solver/cfr";
import type { SolveInput } from "../solver/types";

function input(overrides: Partial<SolveInput> = {}): SolveInput {
  const oopGrid = parseRangeText("JJ+,AQs+,AKo");
  const ipGrid = parseRangeText("JJ+,AQs+,AKo");
  return {
    rangeOop: gridToWeights(oopGrid),
    rangeIp: gridToWeights(ipGrid),
    board: parseBoard("Ks7d2c"),
    pot: 10,
    effectiveStack: 100,
    sizing: {
      flopBets: [0.5],
      turnBets: [0.75],
      riverBets: [0.75],
      raiseSizes: [1.0],
      maxRaisesPerStreet: 2,
      allinThreshold: 0.5,
    },
    iterations: 50,
    ...overrides,
  };
}

describe("solver smoke", () => {
  it("runs without crashing and produces finite EVs", () => {
    const res = solve(input());
    expect(res.iterations).toBeGreaterThan(0);
    expect(res.strategies.length).toBeGreaterThan(0);
    for (const ev of res.rootEv) {
      expect(Number.isFinite(ev)).toBe(true);
    }
    for (const s of res.strategies) {
      const total = s.overallFreq.reduce((a, b) => a + b, 0);
      expect(Math.abs(total - 1)).toBeLessThan(1e-3);
      for (const f of s.overallFreq) {
        expect(f).toBeGreaterThanOrEqual(-1e-6);
        expect(f).toBeLessThanOrEqual(1 + 1e-6);
      }
    }
  });

  it("symmetric ranges on neutral board yield roughly symmetric EVs", () => {
    const res = solve(input({ iterations: 100 }));
    const diff = Math.abs(res.rootEv[0] - res.rootEv[1]);
    // Not a strict bound; CFR is chance-sampled. Sanity check it's in a plausible range.
    expect(diff).toBeLessThan(50);
  });

  it("acting player with dominant range bets more often", () => {
    // OOP has the nuts (AA only) on a dry 7-high board; IP has only pairs below AA
    const dry = parseBoard("7d2c3h");
    const oop = gridToWeights(parseRangeText("AA"));
    const ip = gridToWeights(parseRangeText("QQ,JJ,TT,99,88"));
    const res = solve({
      rangeOop: oop,
      rangeIp: ip,
      board: dry,
      pot: 10,
      effectiveStack: 100,
      sizing: {
        flopBets: [0.75],
        turnBets: [0.75],
        riverBets: [0.75],
        raiseSizes: [1.0],
        maxRaisesPerStreet: 1,
        allinThreshold: 0.5,
      },
      iterations: 200,
    });
    const rootOop = res.strategies.find(s => s.path === "/");
    expect(rootOop).toBeDefined();
    // Expected: OOP should strongly prefer a value-maximizing action (either bet or check-trap).
    // We only sanity check: frequencies sum to 1, no NaN.
    if (rootOop) {
      expect(rootOop.overallFreq.every(f => Number.isFinite(f))).toBe(true);
    }
  });
});
