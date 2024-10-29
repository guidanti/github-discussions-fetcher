import type { Context as ContextType, Operation } from "npm:effection@4.0.0-alpha.2";

export function* ensureContext<T>(Context: ContextType<T>, init: Operation<T>) {
  if (!(yield* Context.get())) {
    yield* Context.set(yield* init);
  }
  return yield* Context.expect();
}
