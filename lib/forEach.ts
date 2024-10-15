import { type Operation, type Queue} from "npm:effection@3.0.3";

export function* forEach<T>(
  op: (item: T) => Operation<void>,
  stream: Queue<T, unknown>,
): Operation<void> {
  let next = yield* stream.next();
  while (!next.done) {
    yield* op(next.value);
    next = yield* stream.next();
  }
}
