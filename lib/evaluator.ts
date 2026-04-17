import { Card, cardRank, cardSuit, popcount } from "./cards";

// Category constants, bigger wins
export const CAT_HIGH = 0;
export const CAT_PAIR = 1;
export const CAT_TWO_PAIR = 2;
export const CAT_TRIPS = 3;
export const CAT_STRAIGHT = 4;
export const CAT_FLUSH = 5;
export const CAT_FULL_HOUSE = 6;
export const CAT_QUADS = 7;
export const CAT_STRAIGHT_FLUSH = 8;

// Returns the highest rank-index (0..12) that completes a 5-card straight, or -1.
// Wheel A-2-3-4-5 returns 3 (five high).
function straightHigh(bits: number): number {
  for (let h = 12; h >= 3; h--) {
    const mask = 0x1f << (h - 4);
    if ((bits & mask) === mask) return h;
  }
  // wheel: A(12), 2(0), 3(1), 4(2), 5(3)
  const wheel = (1 << 12) | (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3);
  if ((bits & wheel) === wheel) return 3;
  return -1;
}

// Return top-N rank indices high→low present in bits (N must be <= popcount(bits))
function topRanks(bits: number, n: number, out: number[]) {
  let i = 0;
  for (let r = 12; r >= 0 && i < n; r--) {
    if (bits & (1 << r)) out[i++] = r;
  }
}

// Pack: (cat << 24) | (k1 << 20) | (k2 << 16) | (k3 << 12) | (k4 << 8) | (k5 << 4)
function pack(cat: number, k1 = 0, k2 = 0, k3 = 0, k4 = 0, k5 = 0): number {
  return (cat << 24) | (k1 << 20) | (k2 << 16) | (k3 << 12) | (k4 << 8) | (k5 << 4);
}

const TMP = new Array<number>(5);

/**
 * Evaluate the best 5-card rank from up to 7 input cards.
 * Higher return value means stronger hand.
 */
export function evaluate(cards: Card[]): number {
  let rankBits = 0;
  const rankCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const suitRankBits = [0, 0, 0, 0];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const r = cardRank(c);
    const s = cardSuit(c);
    rankBits |= 1 << r;
    rankCount[r]++;
    suitRankBits[s] |= 1 << r;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (popcount(suitRankBits[s]) >= 5) { flushSuit = s; break; }
  }

  if (flushSuit >= 0) {
    const fb = suitRankBits[flushSuit];
    const sfHigh = straightHigh(fb);
    if (sfHigh >= 0) return pack(CAT_STRAIGHT_FLUSH, sfHigh);
  }

  // Counting groups. In 7-card hands: at most one quad, at most two trips,
  // at most three pairs (3 pairs + 1 single is 7).
  let quad = -1;
  let trip = -1, trip2 = -1;
  let pair1 = -1, pair2 = -1, pair3 = -1;

  for (let r = 12; r >= 0; r--) {
    const c = rankCount[r];
    if (c === 4) { if (quad < 0) quad = r; }
    else if (c === 3) {
      if (trip < 0) trip = r;
      else if (trip2 < 0) trip2 = r;
    }
    else if (c === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
      else if (pair3 < 0) pair3 = r;
    }
  }

  if (quad >= 0) {
    // kicker is top non-quad rank
    let kicker = -1;
    for (let r = 12; r >= 0; r--) if (r !== quad && rankCount[r] > 0) { kicker = r; break; }
    return pack(CAT_QUADS, quad, kicker);
  }

  // Full house: trip + (best pair or second trip used as pair)
  if (trip >= 0 && (pair1 >= 0 || trip2 >= 0)) {
    const pairRank = pair1 >= 0 && pair1 > trip2 ? pair1 : (trip2 >= 0 ? trip2 : pair1);
    return pack(CAT_FULL_HOUSE, trip, pairRank);
  }

  if (flushSuit >= 0) {
    topRanks(suitRankBits[flushSuit], 5, TMP);
    return pack(CAT_FLUSH, TMP[0], TMP[1], TMP[2], TMP[3], TMP[4]);
  }

  const sHigh = straightHigh(rankBits);
  if (sHigh >= 0) return pack(CAT_STRAIGHT, sHigh);

  if (trip >= 0) {
    let k1 = -1, k2 = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== trip && rankCount[r] > 0) {
        if (k1 < 0) k1 = r;
        else if (k2 < 0) { k2 = r; break; }
      }
    }
    return pack(CAT_TRIPS, trip, k1, k2);
  }

  if (pair1 >= 0 && pair2 >= 0) {
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== pair1 && r !== pair2 && rankCount[r] > 0) { kicker = r; break; }
    }
    return pack(CAT_TWO_PAIR, pair1, pair2, kicker);
  }

  if (pair1 >= 0) {
    let k1 = -1, k2 = -1, k3 = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== pair1 && rankCount[r] > 0) {
        if (k1 < 0) k1 = r;
        else if (k2 < 0) k2 = r;
        else if (k3 < 0) { k3 = r; break; }
      }
    }
    return pack(CAT_PAIR, pair1, k1, k2, k3);
  }

  topRanks(rankBits, 5, TMP);
  return pack(CAT_HIGH, TMP[0], TMP[1], TMP[2], TMP[3], TMP[4]);
}

export function categoryOf(score: number): number {
  return score >>> 24;
}
