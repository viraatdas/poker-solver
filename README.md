# poker-solver

Open-source NLHE postflop GTO solver. Free because paid ones shouldn't be the only option.

Live: **https://poker-solver-gamma.vercel.app**

## What it does

Takes two ranges, a board, pot/stack, and configurable bet sizes, and solves the
current street with CFR+. Outputs per-action frequencies and per-hand strategy
heatmaps.

- Algorithm: CFR+ with linear strategy averaging and alternating updaters
- Terminals: fold wins pot; showdown uses chance-sampled runouts with
  sorted-prefix, blocker-corrected equity
- All per-combo. No bucketing, no card abstraction.
- Runs client-side in a Web Worker — no backend, no rate limits

## Configurable

- OOP / IP ranges (13×13 grid editor + shorthand parser: `JJ+,AQs+,KJo`)
- Board (3, 4, or 5 cards)
- Pot, effective stack, bet sizes per street, raise sizes, max raises / street
- Iteration count

## Stack

Next.js (app router) + TypeScript + Tailwind + framer-motion. Solver in pure TS.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest
pnpm build
```

## Deploy

Any push to `main` auto-deploys to Vercel.
