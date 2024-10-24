import {
  Channel,
  createChannel,
  createContext,
  Operation,
  resource,
} from "npm:effection@4.0.0-alpha.1";
import { DiscussionEntries } from "../types.ts";

export const EntriesContext = createContext<Channel<DiscussionEntries, void>>(
  "entries",
);

export function createEntries() {
  return resource<Channel<DiscussionEntries, void>>(
    function* (provide) {
      const channel = createChannel<DiscussionEntries>();

      try {
        yield* provide(channel);
      } finally {
        yield* channel.close();
      }
    },
  );
}

export function* initEntriesContext(): Operation<
  Channel<DiscussionEntries, void>
> {
  const entries = yield* createEntries();
  return yield* EntriesContext.set(entries);
}

export function* useEntries(): Operation<Channel<DiscussionEntries, void>> {
  return yield* EntriesContext.expect();
}
