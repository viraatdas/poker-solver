import { Action, BetSizing, Player } from "./types";

export type Street = "flop" | "turn" | "river";

export interface DecisionNode {
  type: "decision";
  player: Player;
  path: string;
  street: Street;
  pot: number;                   // pot before this action
  invested: [number, number];    // [oop, ip] committed so far
  stack: [number, number];       // remaining stack per player
  lastBet: number;               // facing bet amount (0 if no bet to call)
  raisesThisStreet: number;      // number of bets/raises this street
  actions: Action[];
  children: Node[];
  regret: Float32Array;          // [1326 × actions.length] CFR+ cumulative regret
  strategySum: Float32Array;     // [1326 × actions.length] linear-weighted strategy sum
  visits: number;                // iterations in which acted
}

export interface TerminalNode {
  type: "terminal";
  path: string;
  kind: "fold" | "showdown";
  winner?: Player;               // for fold: who collects the pot
  pot: number;
  invested: [number, number];
  street: Street;                // street it happened on
}

export type Node = DecisionNode | TerminalNode;

function roundChips(x: number): number {
  return Math.max(0, Math.round(x * 100) / 100);
}

function streetBets(sizing: BetSizing, street: Street): number[] {
  if (street === "flop") return sizing.flopBets;
  if (street === "turn") return sizing.turnBets;
  return sizing.riverBets;
}

function createDecision(
  player: Player,
  path: string,
  street: Street,
  pot: number,
  invested: [number, number],
  stack: [number, number],
  lastBet: number,
  raisesThisStreet: number,
  actions: Action[],
): DecisionNode {
  const n = actions.length;
  return {
    type: "decision",
    player,
    path,
    street,
    pot,
    invested,
    stack,
    lastBet,
    raisesThisStreet,
    actions,
    children: new Array(n),
    regret: new Float32Array(1326 * n),
    strategySum: new Float32Array(1326 * n),
    visits: 0,
  };
}

function terminal(
  path: string,
  kind: "fold" | "showdown",
  pot: number,
  invested: [number, number],
  street: Street,
  winner?: Player,
): TerminalNode {
  return { type: "terminal", path, kind, winner, pot, invested, street };
}

function otherPlayer(p: Player): Player {
  return (1 - p) as Player;
}

export interface BuildContext {
  street: Street;
  sizing: BetSizing;
}

/**
 * Build a single-street betting tree. When a street "completes" (check-check
 * or bet-call), produce a showdown terminal. We do not recurse into subsequent
 * streets; the showdown evaluator handles runout equity for the remaining cards.
 */
export function buildStreetTree(
  startPot: number,
  effectiveStack: number,
  street: Street,
  sizing: BetSizing,
): DecisionNode {
  const root = buildDecision("/", "oop-first", 0, [0, 0], [effectiveStack, effectiveStack], startPot, 0, 0, street, sizing);
  return root;
}

function buildDecision(
  path: string,
  mode: "oop-first" | "respond",
  player: Player,
  invested: [number, number],
  stack: [number, number],
  pot: number,
  lastBet: number,
  raisesThisStreet: number,
  street: Street,
  sizing: BetSizing,
): DecisionNode {
  // Determine available actions.
  const actions: Action[] = [];
  const stackMe = stack[player];
  const stackThem = stack[otherPlayer(player)];

  if (lastBet === 0) {
    // No bet to face.
    actions.push({ kind: "check" });
    if (stackMe > 0 && raisesThisStreet < sizing.maxRaisesPerStreet) {
      const sizes = streetBets(sizing, street);
      for (const f of sizes) {
        const amt = roundChips(Math.min(stackMe, f * pot));
        if (amt > 0 && amt < stackMe) actions.push({ kind: "bet", amount: amt });
      }
      if (stackMe > 0) actions.push({ kind: "allin" });
    }
  } else {
    // Facing a bet. fold, call, maybe raise.
    actions.push({ kind: "fold" });
    const callCost = Math.min(stackMe, lastBet);
    actions.push({ kind: "call" });
    if (raisesThisStreet < sizing.maxRaisesPerStreet && stackMe > callCost && stackThem > 0) {
      for (const f of sizing.raiseSizes) {
        // Raise total to X: new total-to = lastBet + raise_amount, where raise_amount = f * (pot + callMatch*2)
        const potAfterCall = pot + callCost * 2;
        const raiseTo = roundChips(lastBet + Math.min(stackMe - callCost, f * potAfterCall));
        if (raiseTo > lastBet && raiseTo < stackMe + invested[player]) {
          actions.push({ kind: "raise", amount: raiseTo });
        }
      }
      if (stackMe > callCost) actions.push({ kind: "allin" });
    }
  }

  const node = createDecision(player, path, street, pot, invested, stack, lastBet, raisesThisStreet, actions);

  // Build children
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const nextPath = path + actionTag(a, i) + "/";
    node.children[i] = buildChild(a, player, invested, stack, pot, lastBet, raisesThisStreet, street, sizing, nextPath);
  }
  return node;
}

function actionTag(a: Action, idx: number): string {
  if (a.kind === "fold") return "f";
  if (a.kind === "check") return "x";
  if (a.kind === "call") return "c";
  if (a.kind === "bet") return `b${a.amount}`;
  if (a.kind === "raise") return `r${a.amount}`;
  if (a.kind === "allin") return `A`;
  return String(idx);
}

function buildChild(
  a: Action,
  actor: Player,
  invested: [number, number],
  stack: [number, number],
  pot: number,
  lastBet: number,
  raisesThisStreet: number,
  street: Street,
  sizing: BetSizing,
  path: string,
): Node {
  const opp = otherPlayer(actor);
  const inv: [number, number] = [invested[0], invested[1]];
  const stk: [number, number] = [stack[0], stack[1]];

  if (a.kind === "fold") {
    return terminal(path, "fold", pot, invested, street, opp);
  }
  if (a.kind === "check") {
    if (actor === 0) {
      // OOP checks; IP to act
      return buildDecision(path, "respond", 1, inv, stk, pot, 0, raisesThisStreet, street, sizing);
    }
    // IP checks back → street complete, showdown over remaining runouts
    return terminal(path, "showdown", pot, inv, street);
  }
  if (a.kind === "call") {
    // Match lastBet
    const diff = Math.min(stk[actor], lastBet);
    inv[actor] += diff;
    stk[actor] -= diff;
    const newPot = pot + diff;
    // Also opponent may have committed more than actor; recompute pot precisely by summing invested plus startPot offset.
    // In this tree the pot tracks running committed + initial pot. Simpler: pot = startPot + inv[0] + inv[1] (minus startPot counted once). We'll just track pot incrementally.
    return terminal(path, "showdown", newPot, inv, street);
  }
  if (a.kind === "bet") {
    const amt = a.amount;
    inv[actor] += amt;
    stk[actor] -= amt;
    const newPot = pot + amt;
    return buildDecision(path, "respond", opp, inv, stk, newPot, amt, raisesThisStreet + 1, street, sizing);
  }
  if (a.kind === "raise") {
    // `amount` is the total-to amount, i.e. player pushes enough so the bet facing opp is `amount`.
    const callCost = Math.min(stk[actor], lastBet);
    const raiseAdd = a.amount - lastBet;
    const push = callCost + raiseAdd;
    inv[actor] += push;
    stk[actor] -= push;
    const newPot = pot + push;
    return buildDecision(path, "respond", opp, inv, stk, newPot, a.amount, raisesThisStreet + 1, street, sizing);
  }
  if (a.kind === "allin") {
    // Actor shoves remaining stack. New lastBet = lastBet + (shove - callCost) if raising, else shove if opening.
    const push = stk[actor];
    inv[actor] += push;
    stk[actor] = 0;
    const newPot = pot + push;
    let newLastBet: number;
    if (lastBet === 0) {
      newLastBet = push;
    } else {
      const callCost = Math.min(lastBet, push);
      const raisedBy = push - callCost;
      newLastBet = lastBet + raisedBy;
    }
    return buildDecision(path, "respond", opp, inv, stk, newPot, newLastBet, raisesThisStreet + 1, street, sizing);
  }
  throw new Error("unreachable");
}

/** Enumerate all decision nodes via DFS. */
export function allDecisionNodes(root: Node, out: DecisionNode[] = []): DecisionNode[] {
  if (root.type !== "decision") return out;
  out.push(root);
  for (const c of root.children) allDecisionNodes(c, out);
  return out;
}
