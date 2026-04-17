import { describe, it, expect } from "vitest";
import { parseCard } from "../cards";
import {
  evaluate, categoryOf,
  CAT_HIGH, CAT_PAIR, CAT_TWO_PAIR, CAT_TRIPS, CAT_STRAIGHT,
  CAT_FLUSH, CAT_FULL_HOUSE, CAT_QUADS, CAT_STRAIGHT_FLUSH,
} from "../evaluator";

function h(s: string) { return s.split(" ").map(parseCard); }

describe("evaluator categories", () => {
  it("detects royal flush", () => {
    const v = evaluate(h("Ah Kh Qh Jh Th 2c 3d"));
    expect(categoryOf(v)).toBe(CAT_STRAIGHT_FLUSH);
  });
  it("detects wheel straight flush", () => {
    const v = evaluate(h("Ah 2h 3h 4h 5h 8c 9d"));
    expect(categoryOf(v)).toBe(CAT_STRAIGHT_FLUSH);
  });
  it("detects quads", () => {
    const v = evaluate(h("As Ah Ad Ac 2s 3d 4h"));
    expect(categoryOf(v)).toBe(CAT_QUADS);
  });
  it("detects full house", () => {
    const v = evaluate(h("Ks Kh Kd 2c 2s 7h 3d"));
    expect(categoryOf(v)).toBe(CAT_FULL_HOUSE);
  });
  it("full house from two trips picks higher trip", () => {
    const v = evaluate(h("As Ah Ad Ks Kh Kd 2s"));
    expect(categoryOf(v)).toBe(CAT_FULL_HOUSE);
    // pair rank should be K (rank idx 11)
    expect(((v >>> 16) & 0xf)).toBe(11);
    expect(((v >>> 20) & 0xf)).toBe(12);
  });
  it("detects flush", () => {
    const v = evaluate(h("Ah 9h 4h 2h Kh 3c 3d"));
    expect(categoryOf(v)).toBe(CAT_FLUSH);
  });
  it("detects straight", () => {
    const v = evaluate(h("Ts 9h 8d 7c 6s 2h 3d"));
    expect(categoryOf(v)).toBe(CAT_STRAIGHT);
  });
  it("detects wheel straight", () => {
    const v = evaluate(h("As 2h 3d 4c 5s 9h Kd"));
    expect(categoryOf(v)).toBe(CAT_STRAIGHT);
  });
  it("detects trips", () => {
    const v = evaluate(h("9s 9h 9d 2c 3s 7h Kd"));
    expect(categoryOf(v)).toBe(CAT_TRIPS);
  });
  it("detects two pair", () => {
    const v = evaluate(h("9s 9h 4d 4c 3s 7h Kd"));
    expect(categoryOf(v)).toBe(CAT_TWO_PAIR);
  });
  it("detects pair", () => {
    const v = evaluate(h("9s 9h 4d 2c 3s 7h Kd"));
    expect(categoryOf(v)).toBe(CAT_PAIR);
  });
  it("high card", () => {
    const v = evaluate(h("9s 7h 4d 2c 3s Jh Kd"));
    expect(categoryOf(v)).toBe(CAT_HIGH);
  });
  it("straight beats trips", () => {
    const s = evaluate(h("Ts 9h 8d 7c 6s 2h 3d"));
    const t = evaluate(h("9s 9h 9d 2c 3s 7h Kd"));
    expect(s).toBeGreaterThan(t);
  });
  it("flush beats straight", () => {
    const f = evaluate(h("Ah 9h 4h 2h Kh 3c 3d"));
    const s = evaluate(h("Ts 9h 8d 7c 6s 2h 3d"));
    expect(f).toBeGreaterThan(s);
  });
  it("quads beat full house", () => {
    const q = evaluate(h("As Ah Ad Ac 2s 3d 4h"));
    const fh = evaluate(h("Ks Kh Kd 2c 2s 7h 3d"));
    expect(q).toBeGreaterThan(fh);
  });
});
