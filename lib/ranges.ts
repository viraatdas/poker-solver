import { Card, COMBO_COUNT, comboIndex, makeCard, RANKS } from "./cards";

export type Weights = Float32Array; // length COMBO_COUNT (1326)

export type Grid = number[][]; // 13x13 weights in [0, 1]

export function emptyGrid(): Grid {
  return Array.from({ length: 13 }, () => Array(13).fill(0));
}

export type HandKind = "pair" | "suited" | "offsuit";

/** (row, col) in grid → canonical (hiRank, loRank, kind). Ace is index 12, rendered top-left. */
export function cellFromGrid(row: number, col: number): { hi: number; lo: number; kind: HandKind } {
  // Row/col in the visual grid where 0 = Ace row/col (top/left), 12 = Deuce.
  // rank value = 12 - rowOrCol
  const r = 12 - row;
  const c = 12 - col;
  if (r === c) return { hi: r, lo: r, kind: "pair" };
  if (r > c) return { hi: r, lo: c, kind: "suited" };
  return { hi: c, lo: r, kind: "offsuit" };
}

export function gridCellFor(hi: number, lo: number, kind: HandKind): { row: number; col: number } {
  if (kind === "pair") return { row: 12 - hi, col: 12 - hi };
  if (kind === "suited") return { row: 12 - hi, col: 12 - lo };
  return { row: 12 - lo, col: 12 - hi };
}

export function expandCellCombos(hi: number, lo: number, kind: HandKind): Array<[Card, Card]> {
  const out: Array<[Card, Card]> = [];
  if (kind === "pair") {
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = s1 + 1; s2 < 4; s2++)
        out.push([makeCard(hi, s1), makeCard(hi, s2)]);
  } else if (kind === "suited") {
    for (let s = 0; s < 4; s++) out.push([makeCard(hi, s), makeCard(lo, s)]);
  } else {
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = 0; s2 < 4; s2++)
        if (s1 !== s2) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
  }
  return out;
}

export function gridToWeights(grid: Grid): Weights {
  const w = new Float32Array(COMBO_COUNT);
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const v = grid[row][col];
      if (v <= 0) continue;
      const { hi, lo, kind } = cellFromGrid(row, col);
      for (const [a, b] of expandCellCombos(hi, lo, kind)) {
        w[comboIndex(a, b)] = v;
      }
    }
  }
  return w;
}

/** Count combos in a kind to support things like "top X%". */
export function kindSize(kind: HandKind): number {
  return kind === "pair" ? 6 : kind === "suited" ? 4 : 12;
}

/** Parse a shorthand range like "JJ+,AQs+,AJo,TT,KQs". Returns a 13x13 grid. */
export function parseRangeText(text: string): Grid {
  const grid = emptyGrid();
  if (!text) return grid;
  const tokens = text.split(/[\s,]+/).filter(Boolean);
  for (const raw of tokens) {
    const [body, weightStr] = raw.split(":");
    const w = weightStr !== undefined ? clamp01(parseFloat(weightStr)) : 1;
    applyToken(grid, body, w);
  }
  return grid;
}

function clamp01(x: number): number {
  if (!isFinite(x)) return 1;
  return Math.max(0, Math.min(1, x));
}

function rankIdx(ch: string): number {
  const i = RANKS.indexOf(ch.toUpperCase());
  if (i < 0) throw new Error(`bad rank '${ch}'`);
  return i;
}

function applyToken(grid: Grid, tok: string, weight: number) {
  // Accept: "AA", "AKs", "AKo", "AK", "JJ+", "77-22" or "22-77", "AQs+", "KJo-K8o" etc.
  let t = tok.trim();
  if (!t) return;

  // range "X-Y"
  if (t.includes("-") && !t.endsWith("+")) {
    const [a, b] = t.split("-");
    applyRange(grid, a, b, weight);
    return;
  }

  // plus "X+"
  if (t.endsWith("+")) {
    const base = t.slice(0, -1);
    applyPlus(grid, base, weight);
    return;
  }

  applySingle(grid, t, weight);
}

function applySingle(grid: Grid, t: string, weight: number) {
  if (t.length === 2) {
    const r1 = rankIdx(t[0]);
    const r2 = rankIdx(t[1]);
    if (r1 === r2) setCell(grid, r1, r1, "pair", weight);
    else {
      const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
      setCell(grid, hi, lo, "suited", weight);
      setCell(grid, hi, lo, "offsuit", weight);
    }
    return;
  }
  if (t.length === 3) {
    const r1 = rankIdx(t[0]);
    const r2 = rankIdx(t[1]);
    const kind = t[2].toLowerCase() === "s" ? "suited" : "offsuit";
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    setCell(grid, hi, lo, kind, weight);
    return;
  }
  throw new Error(`bad token '${t}'`);
}

function applyPlus(grid: Grid, base: string, weight: number) {
  // Pairs: "77+" = 77 through AA
  if (base.length === 2 && base[0] === base[1]) {
    const r = rankIdx(base[0]);
    for (let rr = r; rr <= 12; rr++) setCell(grid, rr, rr, "pair", weight);
    return;
  }
  if (base.length === 2) {
    const a = rankIdx(base[0]);
    const b = rankIdx(base[1]);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    // Walk lo upward toward hi - 1
    for (let l = lo; l < hi; l++) {
      setCell(grid, hi, l, "suited", weight);
      setCell(grid, hi, l, "offsuit", weight);
    }
    return;
  }
  if (base.length === 3) {
    const a = rankIdx(base[0]);
    const b = rankIdx(base[1]);
    const kind = base[2].toLowerCase() === "s" ? "suited" : "offsuit";
    const hi = Math.max(a, b), lo = Math.min(a, b);
    for (let l = lo; l < hi; l++) setCell(grid, hi, l, kind, weight);
    return;
  }
  throw new Error(`bad + token '${base}+'`);
}

function applyRange(grid: Grid, a: string, b: string, weight: number) {
  // Pairs: "22-77"
  if (a.length === 2 && a[0] === a[1] && b.length === 2 && b[0] === b[1]) {
    const ra = rankIdx(a[0]);
    const rb = rankIdx(b[0]);
    const from = Math.min(ra, rb), to = Math.max(ra, rb);
    for (let r = from; r <= to; r++) setCell(grid, r, r, "pair", weight);
    return;
  }
  // Gappers with fixed hi card, e.g. "AQs-A9s" or "KJo-K8o" or "AK-AT"
  if (a.length === b.length && a[0] === b[0]) {
    const hi = rankIdx(a[0]);
    const loA = rankIdx(a[1]);
    const loB = rankIdx(b[1]);
    const from = Math.min(loA, loB), to = Math.max(loA, loB);
    const kind = a.length === 3 ? (a[2].toLowerCase() === "s" ? "suited" : "offsuit") : null;
    for (let l = from; l <= to; l++) {
      if (kind) setCell(grid, hi, l, kind, weight);
      else {
        setCell(grid, hi, l, "suited", weight);
        setCell(grid, hi, l, "offsuit", weight);
      }
    }
    return;
  }
  throw new Error(`unsupported range '${a}-${b}'`);
}

function setCell(grid: Grid, hi: number, lo: number, kind: HandKind, weight: number) {
  const { row, col } = gridCellFor(hi, lo, kind);
  grid[row][col] = weight;
}

/** Readable label for a grid cell. */
export function cellLabel(row: number, col: number): string {
  const { hi, lo, kind } = cellFromGrid(row, col);
  const h = RANKS[hi], l = RANKS[lo];
  if (kind === "pair") return h + h;
  if (kind === "suited") return h + l + "s";
  return h + l + "o";
}

export function rangeCombos(w: Weights): number {
  let n = 0;
  for (let i = 0; i < w.length; i++) if (w[i] > 0) n++;
  return n;
}

export function totalWeight(w: Weights): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i];
  return s;
}
