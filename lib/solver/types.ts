import type { Weights } from "../ranges";

export type Player = 0 | 1; // 0 = OOP, 1 = IP

export type Action =
  | { kind: "fold" }
  | { kind: "check" }
  | { kind: "call" }
  | { kind: "bet"; amount: number }
  | { kind: "raise"; amount: number }
  | { kind: "allin" };

export interface BetSizing {
  /** Fraction of pot, e.g. 0.33, 0.75, 1.5. Always in open-bet context. */
  flopBets: number[];
  turnBets: number[];
  riverBets: number[];
  /** Raise sizes as fraction of pot after the bet. */
  raiseSizes: number[];
  /** Max raises per street (bet counts as the first "raise" in the sequence). */
  maxRaisesPerStreet: number;
  /** Include all-in shove action when stack/pot ratio is below this fraction. */
  allinThreshold: number;
}

export interface SolveInput {
  rangeOop: Weights;
  rangeIp: Weights;
  board: number[]; // 3, 4, or 5 cards
  pot: number;
  effectiveStack: number;
  sizing: BetSizing;
  iterations: number;
}

export interface NodeStrategy {
  /** Path key, e.g. "/", "/b33/", "/b33/r3/". */
  path: string;
  player: Player;
  actions: Action[];
  /** Aggregated action frequencies across the acting player's full range (weight-weighted). */
  overallFreq: number[];
  /** Per-combo final strategy. size = 1326 × actions. */
  perCombo: Float32Array;
  pot: number;
  invested: [number, number]; // [oop, ip] invested before this decision
}

export interface SolveResult {
  iterations: number;
  strategies: NodeStrategy[];
  rootEv: [number, number]; // expected utility per player at root, normalized per combo of the range
  exploitability?: number;
}

export interface SolveProgress {
  iteration: number;
  total: number;
  rootEv: [number, number];
}
