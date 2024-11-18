import { createContext, Operation } from "npm:effection@4.0.0-alpha.3";
import { ensureContext } from "./ensureContext.ts";

interface CostEntries {
  cost: number;
  remaining: number;
  nodeCount: number;
}

interface CostSummary extends CostEntries {
  queryCount: number;
}

export const CostContext = createContext<Cost>(
  "cost",
);

export interface CostTracker {
  total: CostEntries;
  queryCount: number;
  update(entry: CostEntries): void;
  summary(): CostSummary;
}

class Cost implements CostTracker {
  public total = {
    cost: 0,
    remaining: 0,
    nodeCount: 0,
  };
  public queryCount = 0;
  constructor() {}

  update(entry: CostEntries) {
    this.total = {
      cost: this.total.cost + entry.cost,
      remaining: entry.remaining,
      nodeCount: this.total.nodeCount + entry.nodeCount,
    };
    this.queryCount++;
  }

  summary() {
    return {
      ...this.total,
      queryCount: this.queryCount,
    };
  }
}

export function* initCostContext() {
  // deno-lint-ignore require-yield
  function* init() {
    return new Cost();
  }

  return yield* ensureContext(CostContext, init());
}

export function* useCost(): Operation<Cost> {
  return yield* CostContext.expect();
}
