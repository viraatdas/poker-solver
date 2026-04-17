/// <reference lib="webworker" />
import { solve } from "@/lib/solver/cfr";
import type { SolveInput } from "@/lib/solver/types";

declare const self: DedicatedWorkerGlobalScope;

let stopFlag = false;

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === "stop") {
    stopFlag = true;
    return;
  }
  if (msg.type === "solve") {
    stopFlag = false;
    const input = rehydrateInput(msg.input);
    try {
      const result = solve(
        input,
        (iter, total, evOop, evIp) => {
          self.postMessage({
            type: "progress",
            data: { iter, total, evOop, evIp },
          });
        },
        () => stopFlag,
      );
      self.postMessage({
        type: "done",
        data: {
          iterations: result.iterations,
          rootEv: result.rootEv,
          strategies: result.strategies.map((s) => ({
            ...s,
            perCombo: Array.from(s.perCombo),
          })),
        },
      });
    } catch (err: any) {
      self.postMessage({ type: "error", message: err?.message ?? String(err) });
    }
  }
};

function rehydrateInput(raw: any): SolveInput {
  return {
    ...raw,
    rangeOop: new Float32Array(raw.rangeOop),
    rangeIp: new Float32Array(raw.rangeIp),
  };
}
