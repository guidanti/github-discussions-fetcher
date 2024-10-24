import type { Context as ContextType, Operation } from "npm:effection@4.0.0-alpha.1";

function isMissingContextError(
  error: unknown,
): error is { name: "MissingContextError" } {
  return error != null &&
    (error as { name: string }).name === "MissingContextError";
}

export function* ensureContext<T>(Context: ContextType<T>, init: Operation<T>) {
  if (!(yield* Context.get())) {
    yield* Context.set(yield* init);
  }
  return yield* Context.expect();
}
