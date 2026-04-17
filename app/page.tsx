import Solver from "@/components/Solver";

export default function Page() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-500">Open-source GTO</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">NLHE Postflop Solver</h1>
          <p className="text-ink-500 text-sm mt-1">CFR+ with chance-sampled multi-street support. Configurable ranges, bet sizes, and stacks.</p>
        </div>
        <a
          href="https://github.com/viraatdas/poker-solver"
          className="btn btn-ghost"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>
      <Solver />
    </main>
  );
}
