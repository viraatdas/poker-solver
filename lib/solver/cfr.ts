import { Card, COMBO_COUNT, comboFromIndex } from "../cards";
import { scoreAllCombos, sampleRunout } from "./equity";
import {
  Node, DecisionNode, TerminalNode, allDecisionNodes, buildStreetTree,
} from "./tree";
import { SolveInput, SolveResult, NodeStrategy, Action } from "./types";

/**
 * Chance-sampled CFR+ for a single postflop street.
 * Terminal values:
 *  - Fold: non-folding player collects the pot.
 *  - Showdown: compare hand strength on a sampled complete runout.
 *
 * Uses per-combo strategies (public CFR). Blocker-corrected showdown equity via
 * sorted prefix-sums over opponent reach, giving O(C log C) per terminal.
 */
export class SolverContext {
  input: SolveInput;
  root: DecisionNode;
  decisionNodes: DecisionNode[];
  // reusable buffers
  sortedIdx = new Int32Array(COMBO_COUNT);
  rankPos = new Int32Array(COMBO_COUNT);
  cumTotal = new Float64Array(COMBO_COUNT + 1);
  cumCard: Float64Array[] = Array.from({ length: 52 }, () => new Float64Array(COMBO_COUNT + 1));
  combosA = new Int8Array(COMBO_COUNT);
  combosB = new Int8Array(COMBO_COUNT);
  scores = new Int32Array(COMBO_COUNT);
  iter = 0;

  constructor(input: SolveInput) {
    this.input = input;
    this.root = buildStreetTree(input.pot, input.effectiveStack, streetForBoard(input.board), input.sizing);
    this.decisionNodes = allDecisionNodes(this.root);
    for (let i = 0; i < COMBO_COUNT; i++) {
      const [a, b] = comboFromIndex(i);
      this.combosA[i] = a;
      this.combosB[i] = b;
    }
  }
}

function streetForBoard(board: Card[]) {
  if (board.length === 3) return "flop" as const;
  if (board.length === 4) return "turn" as const;
  return "river" as const;
}

function regretMatchingPlus(
  regret: Float32Array,
  nCombos: number,
  nActions: number,
  strategy: Float32Array,
) {
  for (let c = 0; c < nCombos; c++) {
    const base = c * nActions;
    let sum = 0;
    for (let a = 0; a < nActions; a++) {
      const r = regret[base + a];
      if (r > 0) sum += r;
    }
    if (sum > 0) {
      const inv = 1 / sum;
      for (let a = 0; a < nActions; a++) {
        const r = regret[base + a];
        strategy[base + a] = r > 0 ? r * inv : 0;
      }
    } else {
      const u = 1 / nActions;
      for (let a = 0; a < nActions; a++) strategy[base + a] = u;
    }
  }
}

/** Sort combo indices by score ascending. Invalid combos (score < 0) go to the end and are ignored via nValid. */
function sortByScore(scores: Int32Array, out: Int32Array): number {
  let nValid = 0;
  for (let i = 0; i < COMBO_COUNT; i++) if (scores[i] >= 0) out[nValid++] = i;
  // In-place sort slice by score
  const slice = out.subarray(0, nValid);
  // Convert to array for sort (TypedArray sort is numeric by default)
  const tmp = Array.from(slice).sort((a, b) => scores[a] - scores[b]);
  for (let i = 0; i < nValid; i++) out[i] = tmp[i];
  return nValid;
}

/**
 * Build prefix sums over opponent reach in sorted-by-score order.
 * cumTotal[i] = sum of reachO[sorted[0..i-1]]  (so cumTotal[0]=0, cumTotal[nValid]=totalReach)
 * cumCard[k][i] = same but only for opp combos containing card k.
 */
function buildPrefixSums(
  ctx: SolverContext,
  reachO: Float32Array,
  nValid: number,
): void {
  const { sortedIdx, cumTotal, cumCard, combosA, combosB } = ctx;
  cumTotal[0] = 0;
  for (let k = 0; k < 52; k++) cumCard[k][0] = 0;

  let running = 0;
  const cardRun = new Float64Array(52);

  for (let i = 0; i < nValid; i++) {
    const c = sortedIdx[i];
    const w = reachO[c];
    running += w;
    if (w > 0) {
      cardRun[combosA[c]] += w;
      cardRun[combosB[c]] += w;
    }
    cumTotal[i + 1] = running;
    // copy cardRun into cumCard[k][i+1]
    for (let k = 0; k < 52; k++) cumCard[k][i + 1] = cardRun[k];
  }
}

/**
 * Compute showdown utility per combo for player P given opponent reach and blocker correction.
 *
 * util[c_p] = pot*(W + 0.5*T) - invP * compat
 *   where W/T/compat are computed against opponent combos that do NOT share cards with c_p.
 *
 * Assumes P is OOP. For IP, callers should pass pot/invP from IP's side and this function
 * still works — it's symmetric; `reachO` is always "the other player's reach".
 */
function showdownUtility(
  ctx: SolverContext,
  scores: Int32Array,
  reachO: Float32Array,
  pot: number,
  invP: number,
  out: Float32Array,
  nValid: number,
): void {
  const { sortedIdx, rankPos, cumTotal, cumCard, combosA, combosB } = ctx;

  // rankPos[c] = sorted position of combo c; for invalid combos, remains stale — we skip them.
  for (let i = 0; i < nValid; i++) rankPos[sortedIdx[i]] = i;

  const totalReach = cumTotal[nValid];

  for (let c = 0; c < COMBO_COUNT; c++) {
    if (scores[c] < 0) { out[c] = 0; continue; }
    const pos = rankPos[c];
    const s = scores[c];

    // Find contiguous block of same-score combos around pos
    let tieStart = pos;
    while (tieStart > 0 && scores[sortedIdx[tieStart - 1]] === s) tieStart--;
    let tieEnd = pos + 1;
    while (tieEnd < nValid && scores[sortedIdx[tieEnd]] === s) tieEnd++;

    const W_raw = cumTotal[tieStart];                         // reach with score strictly less
    const T_raw = cumTotal[tieEnd] - cumTotal[tieStart];      // reach with equal score

    // Blocker correction: opp combos containing my cards are not really possible.
    const a = combosA[c], b = combosB[c];

    const W_blkA = cumCard[a][tieStart];
    const W_blkB = cumCard[b][tieStart];
    const T_blkA = cumCard[a][tieEnd] - cumCard[a][tieStart];
    const T_blkB = cumCard[b][tieEnd] - cumCard[b][tieStart];

    // Over-subtraction: combo (a,b) itself is subtracted once for card a and once for card b.
    // But combo (a,b) is the SAME combo as c, which should never contribute (me vs me).
    // If c has weight w_c in reachO (not relevant here, it's reach of opp; still, a valid own-combo in opp range should be blocked because it shares both cards with me).
    // Because blocker subtraction subtracts cardA-holders AND cardB-holders, the (a,b) combo is subtracted twice; add once back.
    // We need to know whether (a,b) is in "below", "tie", or "above" and apply correctly.
    // (a,b) == combo c, score s, so it's in the tie block.
    const selfReach = reachO[c];

    const W_blk = W_blkA + W_blkB; // combo (a,b) not in below block (it's in tie) so no double-count there
    const T_blk = T_blkA + T_blkB - selfReach; // combo (a,b) is in tie block, subtracted via both cards → add once

    const W = W_raw - W_blk;
    const T = T_raw - T_blk;

    // compatibility normalizer (how much reach is actually possible given blockers)
    const totalBlk = cumCard[a][nValid] + cumCard[b][nValid] - selfReach;
    const compat = totalReach - totalBlk;

    if (compat <= 0) {
      out[c] = 0;
      continue;
    }
    out[c] = pot * (W + 0.5 * T) - invP * compat;
  }
}

/** Fold terminal: non-folder collects pot; folder loses their investment. Card-blocker-corrected reach. */
function foldUtility(
  ctx: SolverContext,
  reachO: Float32Array,
  pot: number,
  invP: number,
  pWon: boolean,
  scores: Int32Array,
  nValid: number,
  out: Float32Array,
): void {
  const { cumTotal, cumCard, combosA, combosB } = ctx;
  const totalReach = cumTotal[nValid];
  for (let c = 0; c < COMBO_COUNT; c++) {
    if (scores[c] < 0) { out[c] = 0; continue; }
    const a = combosA[c], b = combosB[c];
    const totalBlk = cumCard[a][nValid] + cumCard[b][nValid] - reachO[c];
    const compat = totalReach - totalBlk;
    if (compat <= 0) { out[c] = 0; continue; }
    out[c] = (pWon ? pot : 0) * compat - invP * compat;
  }
}

/**
 * One CFR+ pass for updating player p. Returns expected utility per combo of p.
 *
 * reachP: reach of updating player into this node (per combo)
 * reachO: reach of the opponent into this node (per combo)
 */
function cfrPass(
  ctx: SolverContext,
  node: Node,
  scores: Int32Array,
  nValid: number,
  reachP: Float32Array,
  reachO: Float32Array,
  updater: 0 | 1,
  iter: number,
): Float32Array {
  if (node.type === "terminal") {
    const result = new Float32Array(COMBO_COUNT);
    const invP = node.invested[updater];
    if (node.kind === "fold") {
      const pWon = node.winner === updater;
      buildPrefixSums(ctx, reachO, nValid);
      foldUtility(ctx, reachO, node.pot, invP, pWon, scores, nValid, result);
      return result;
    }
    // showdown
    buildPrefixSums(ctx, reachO, nValid);
    showdownUtility(ctx, scores, reachO, node.pot, invP, result, nValid);
    return result;
  }

  const nActions = node.actions.length;
  const strategy = new Float32Array(COMBO_COUNT * nActions);
  regretMatchingPlus(node.regret, COMBO_COUNT, nActions, strategy);

  const nodeUtil = new Float32Array(COMBO_COUNT);
  const actionUtils: Float32Array[] = new Array(nActions);

  if (node.player === updater) {
    // Updater decides. Own reach is not baked into utilities (util is conditional on combo),
    // so we recurse with reachP unchanged and weight by strategy afterwards.
    for (let a = 0; a < nActions; a++) {
      actionUtils[a] = cfrPass(ctx, node.children[a], scores, nValid, reachP, reachO, updater, iter);
    }
    for (let c = 0; c < COMBO_COUNT; c++) {
      let u = 0;
      for (let a = 0; a < nActions; a++) u += strategy[c * nActions + a] * actionUtils[a][c];
      nodeUtil[c] = u;
    }
    // Regret update (CFR+) and strategy-sum (linear weighting)
    const w = iter; // linear-CFR-style weight
    for (let c = 0; c < COMBO_COUNT; c++) {
      const base = c * nActions;
      const pc = reachP[c];
      for (let a = 0; a < nActions; a++) {
        const regret = node.regret[base + a] + (actionUtils[a][c] - nodeUtil[c]);
        node.regret[base + a] = regret > 0 ? regret : 0;
        node.strategySum[base + a] += w * pc * strategy[base + a];
      }
    }
    node.visits++;
  } else {
    // Opponent decides. Their per-combo strategy is multiplied into reachO when recursing;
    // the returned action utilities are already reach-weighted, so the node utility is just their SUM.
    for (let a = 0; a < nActions; a++) {
      const newReachO = new Float32Array(COMBO_COUNT);
      for (let c = 0; c < COMBO_COUNT; c++) newReachO[c] = reachO[c] * strategy[c * nActions + a];
      actionUtils[a] = cfrPass(ctx, node.children[a], scores, nValid, reachP, newReachO, updater, iter);
    }
    for (let c = 0; c < COMBO_COUNT; c++) {
      let u = 0;
      for (let a = 0; a < nActions; a++) u += actionUtils[a][c];
      nodeUtil[c] = u;
    }
    // Track strategy-sum and regret for opponent too, so both players get averaged strategies.
    // Regret update needs util per opponent combo — we don't have that vectorized here.
    // Instead, we rely on alternating the updater each iteration; when opp becomes updater,
    // their regrets/strategySum are updated via the `node.player === updater` branch.
  }

  return nodeUtil;
}

/** Public runner. Samples runouts, runs CFR+ iters, computes averaged strategies. */
export function solve(
  input: SolveInput,
  onProgress?: (it: number, total: number, evOop: number, evIp: number) => void,
  shouldStop?: () => boolean,
): SolveResult {
  const ctx = new SolverContext(input);
  const total = Math.max(1, input.iterations);

  let lastEvOop = 0, lastEvIp = 0;

  for (let it = 1; it <= total; it++) {
    if (shouldStop && shouldStop()) {
      break;
    }
    ctx.iter = it;
    // Sample a runout
    const board = sampleRunout(input.board, 0);
    const scores = scoreAllCombos(board);
    ctx.scores = scores;
    const nValid = sortByScore(scores, ctx.sortedIdx);

    // Alternate updater
    const updater: 0 | 1 = (it % 2) as 0 | 1;

    const reachOop = cloneWeights(input.rangeOop);
    const reachIp = cloneWeights(input.rangeIp);
    zeroConflictingCombos(reachOop, scores);
    zeroConflictingCombos(reachIp, scores);

    // We want per-iter EV for progress. Run pass for player 0 and capture root utility.
    const util = cfrPass(
      ctx,
      ctx.root,
      scores,
      nValid,
      updater === 0 ? reachOop : reachIp,
      updater === 0 ? reachIp : reachOop,
      updater,
      it,
    );

    // Track EV: mean utility weighted by reach
    if (updater === 0) {
      lastEvOop = weightedMean(util, reachOop);
    } else {
      lastEvIp = weightedMean(util, reachIp);
    }

    if (onProgress && (it === total || it % Math.max(1, Math.floor(total / 50)) === 0)) {
      onProgress(it, total, lastEvOop, lastEvIp);
    }
  }

  return {
    iterations: ctx.iter,
    strategies: extractStrategies(ctx),
    rootEv: [lastEvOop, lastEvIp],
  };
}

function cloneWeights(w: Float32Array): Float32Array {
  const out = new Float32Array(w.length);
  out.set(w);
  return out;
}

function zeroConflictingCombos(w: Float32Array, scores: Int32Array) {
  for (let i = 0; i < w.length; i++) if (scores[i] < 0) w[i] = 0;
}

function weightedMean(util: Float32Array, w: Float32Array): number {
  let num = 0, den = 0;
  for (let i = 0; i < util.length; i++) {
    num += util[i] * w[i];
    den += w[i];
  }
  return den > 0 ? num / den : 0;
}

function extractStrategies(ctx: SolverContext): NodeStrategy[] {
  const out: NodeStrategy[] = [];
  for (const node of ctx.decisionNodes) {
    const n = node.actions.length;
    const avg = new Float32Array(COMBO_COUNT * n);
    for (let c = 0; c < COMBO_COUNT; c++) {
      const base = c * n;
      let sum = 0;
      for (let a = 0; a < n; a++) sum += node.strategySum[base + a];
      if (sum > 0) {
        for (let a = 0; a < n; a++) avg[base + a] = node.strategySum[base + a] / sum;
      } else {
        const u = 1 / n;
        for (let a = 0; a < n; a++) avg[base + a] = u;
      }
    }
    // Overall per-action freq, weighted by acting player's range (use input ranges as proxy)
    const rng = node.player === 0 ? ctx.input.rangeOop : ctx.input.rangeIp;
    const overall = new Array(n).fill(0);
    let totalW = 0;
    for (let c = 0; c < COMBO_COUNT; c++) {
      const w = rng[c];
      if (w <= 0) continue;
      totalW += w;
      for (let a = 0; a < n; a++) overall[a] += w * avg[c * n + a];
    }
    if (totalW > 0) for (let a = 0; a < n; a++) overall[a] /= totalW;
    out.push({
      path: node.path,
      player: node.player,
      actions: node.actions.slice(),
      overallFreq: overall,
      perCombo: avg,
      pot: node.pot,
      invested: [node.invested[0], node.invested[1]],
    });
  }
  return out;
}
