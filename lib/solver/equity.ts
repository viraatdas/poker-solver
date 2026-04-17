import { Card, COMBO_COUNT, comboFromIndex } from "../cards";
import { evaluate } from "../evaluator";

/**
 * For a fully specified 5-card board, compute the per-combo hand score for all 1326 combos.
 * Combos using any board card get NaN score (marked unavailable).
 */
export function scoreAllCombos(board: Card[]): Int32Array {
  if (board.length !== 5) throw new Error("scoreAllCombos requires 5-card board");
  const scores = new Int32Array(COMBO_COUNT);
  const boardMask = boardCardMask(board);
  const seven: Card[] = [0, 0, board[0], board[1], board[2], board[3], board[4]];
  for (let i = 0; i < COMBO_COUNT; i++) {
    const [a, b] = comboFromIndex(i);
    if ((boardMask & (1 << a)) || (boardMask & (1 << b))) {
      scores[i] = -1;
      continue;
    }
    seven[0] = a;
    seven[1] = b;
    scores[i] = evaluate(seven);
  }
  return scores;
}

export function boardCardMask(board: Card[]): number {
  let m = 0;
  for (const c of board) m |= 1 << c;
  return m;
}

/**
 * Compute equity per combo for OOP (vs IP's weighted range) on a fully specified board.
 * Returns Float32Array(1326) of equities in [0, 1] for OOP combos. IP equity = 1 - eqOop (roughly; with card-blocking normalization).
 *
 * This enumerates all 1326 opponent combos, accounting for card conflicts (hole-card blockers).
 * Runs in O(C * C) per call in the worst case (~1.76M ops). For use at leaves we call with pre-
 * computed scores to avoid re-evaluating.
 */
export function equityOopVsIp(
  scores: Int32Array,
  reachIp: Float32Array,
): Float32Array {
  const eq = new Float32Array(COMBO_COUNT);
  // Build an index list of opponent combos with nonzero reach.
  const oppCount = reachIp.length;
  const oppIdx: number[] = [];
  const oppWeight: number[] = [];
  const oppScore: number[] = [];
  for (let i = 0; i < oppCount; i++) {
    if (reachIp[i] > 0 && scores[i] >= 0) {
      oppIdx.push(i);
      oppWeight.push(reachIp[i]);
      oppScore.push(scores[i]);
    }
  }

  const nOpp = oppIdx.length;
  if (nOpp === 0) return eq;

  // Precompute cards for each opponent combo.
  const oppA = new Int8Array(nOpp);
  const oppB = new Int8Array(nOpp);
  for (let j = 0; j < nOpp; j++) {
    const [a, b] = comboFromIndex(oppIdx[j]);
    oppA[j] = a;
    oppB[j] = b;
  }

  for (let i = 0; i < COMBO_COUNT; i++) {
    const sI = scores[i];
    if (sI < 0) continue;
    const [myA, myB] = comboFromIndex(i);
    let winW = 0, tieW = 0, loseW = 0, totalW = 0;
    for (let j = 0; j < nOpp; j++) {
      const a = oppA[j], b = oppB[j];
      if (a === myA || a === myB || b === myA || b === myB) continue;
      const w = oppWeight[j];
      const sJ = oppScore[j];
      totalW += w;
      if (sI > sJ) winW += w;
      else if (sI === sJ) tieW += w;
      else loseW += w;
    }
    if (totalW > 0) {
      eq[i] = (winW + 0.5 * tieW) / totalW;
    }
  }
  return eq;
}

/**
 * Sample a random runout completing a board of length 3 or 4 to 5 cards.
 * Re-rolls card indices that collide with existing board or avoid set.
 */
export function sampleRunout(board: Card[], avoid: number): Card[] {
  const need = 5 - board.length;
  if (need === 0) return board.slice();
  const out = board.slice();
  let mask = avoid;
  for (const c of board) mask |= 1 << c;
  while (out.length < 5) {
    const c = (Math.random() * 52) | 0;
    if (mask & (1 << c)) continue;
    mask |= 1 << c;
    out.push(c);
  }
  return out;
}

/**
 * Enumerate all possible 5-card completions of a (3 or 4)-card board and call `onBoard` for each.
 * (Use only when small: 3→1081 turns*46 rivers=~1081 boards; 4→46 rivers.)
 */
export function forEachRunout(board: Card[], fn: (b: Card[]) => void): void {
  if (board.length === 5) { fn(board); return; }
  const buf = board.slice();
  const mask = boardCardMask(board);
  if (board.length === 4) {
    buf.push(0);
    for (let r = 0; r < 52; r++) {
      if (mask & (1 << r)) continue;
      buf[4] = r;
      fn(buf);
    }
    return;
  }
  if (board.length === 3) {
    buf.push(0, 0);
    for (let t = 0; t < 52; t++) {
      if (mask & (1 << t)) continue;
      buf[3] = t;
      const m2 = mask | (1 << t);
      for (let r = t + 1; r < 52; r++) {
        if (m2 & (1 << r)) continue;
        buf[4] = r;
        fn(buf);
      }
    }
    return;
  }
  throw new Error("board must have 3, 4, or 5 cards");
}
