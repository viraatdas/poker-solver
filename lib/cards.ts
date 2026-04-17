export const RANKS = "23456789TJQKA";
export const SUITS = "cdhs";

export const RANK_COUNT = 13;
export const SUIT_COUNT = 4;
export const DECK_SIZE = 52;

export type Card = number; // 0..51 packed as rank*4 + suit

export function makeCard(rank: number, suit: number): Card {
  return rank * 4 + suit;
}
export function cardRank(c: Card): number { return c >>> 2; }
export function cardSuit(c: Card): number { return c & 3; }

export function parseCard(s: string): Card {
  if (s.length !== 2) throw new Error(`bad card '${s}'`);
  const r = RANKS.indexOf(s[0].toUpperCase());
  const suit = SUITS.indexOf(s[1].toLowerCase());
  if (r < 0 || suit < 0) throw new Error(`bad card '${s}'`);
  return makeCard(r, suit);
}
export function cardStr(c: Card): string {
  return RANKS[cardRank(c)] + SUITS[cardSuit(c)];
}

export function parseBoard(s: string): Card[] {
  if (!s) return [];
  const trimmed = s.replace(/\s+/g, "");
  const out: Card[] = [];
  for (let i = 0; i < trimmed.length; i += 2) {
    out.push(parseCard(trimmed.slice(i, i + 2)));
  }
  return out;
}

// Canonical index for an unordered pair {a,b} with 0 <= b < a <= 51.
// Range: 0..1325 (1326 distinct combos = C(52,2))
export const COMBO_COUNT = (DECK_SIZE * (DECK_SIZE - 1)) / 2; // 1326
export function comboIndex(a: Card, b: Card): number {
  const hi = a > b ? a : b;
  const lo = a > b ? b : a;
  return (hi * (hi - 1)) / 2 + lo;
}
export function comboFromIndex(idx: number): [Card, Card] {
  let hi = 1;
  while ((hi * (hi - 1)) / 2 <= idx) hi++;
  hi--;
  const lo = idx - (hi * (hi - 1)) / 2;
  return [hi, lo];
}

export function popcount(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
