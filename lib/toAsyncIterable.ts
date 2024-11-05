import type { Scope, Queue } from "npm:effection@4.0.0-alpha.3";

export function toAsyncIterable<T>(queue: Queue<T, unknown>, scope: Scope): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      let next = await scope.run(queue.next);

      while (true) {
        if (!next.done) {
          yield next.value;
        } else {
          break;
        }
        next = await scope.run(queue.next);
      }
      return next.value;
    }
  }
}