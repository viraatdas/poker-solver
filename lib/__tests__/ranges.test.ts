import { describe, it, expect } from "vitest";
import { parseRangeText, gridToWeights, rangeCombos } from "../ranges";

function nz(g: number[][]) { let n = 0; for (const row of g) for (const v of row) if (v > 0) n++; return n; }

describe("range parser", () => {
  it("parses pairs", () => {
    const g = parseRangeText("AA,KK,QQ");
    expect(nz(g)).toBe(3);
    const w = gridToWeights(g);
    expect(rangeCombos(w)).toBe(18); // 3 pairs × 6 combos
  });
  it("parses JJ+", () => {
    const g = parseRangeText("JJ+");
    expect(nz(g)).toBe(4);
  });
  it("parses AQs+", () => {
    const g = parseRangeText("AQs+");
    expect(nz(g)).toBe(2);
    const w = gridToWeights(g);
    expect(rangeCombos(w)).toBe(8);
  });
  it("parses broadways range", () => {
    const g = parseRangeText("JJ+,AJs+,KQs,AQo+");
    const w = gridToWeights(g);
    // JJ QQ KK AA = 24 combos
    // AJs AQs AKs = 12
    // KQs = 4
    // AQo AKo = 24
    expect(rangeCombos(w)).toBe(64);
  });
  it("parses weight", () => {
    const g = parseRangeText("AA:0.5");
    expect(g.some(row => row.some(v => v === 0.5))).toBe(true);
  });
  it("parses 22-77", () => {
    const g = parseRangeText("22-77");
    expect(nz(g)).toBe(6);
  });
});
