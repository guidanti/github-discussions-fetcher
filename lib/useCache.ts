import { ensureFile, exists, walkSync, emptyDir } from "jsr:@std/fs@1.0.4";
import { basename, dirname, globToRegExp, join } from "jsr:@std/path@1.0.6";
import {
  call,
  createContext,
  createQueue,
  type Operation,
  Queue,
  spawn,
  type Stream,
  stream,
} from "npm:effection@4.0.0-alpha.1";

import { ensureContext } from "./ensureContext.ts";
import { JSONLinesParseStream } from './jsonlines/parser.ts';

export interface Cache {
  location: URL;
  write(key: string, data: unknown): Operation<void>;
  read<T>(key: string): Operation<Stream<T, unknown>>;
  has(key: string): Operation<boolean>;
  find<T>(directory: string): Operation<Queue<T, unknown>>;
  clear(): Operation<void>;
}

export const CacheContext = createContext<Cache>("cache");

interface InitCacheContextOptions {
  location: URL;
}

export function* initCacheContext(options: InitCacheContextOptions) {

  // deno-lint-ignore require-yield
  function* init() {
    return new PersistantCache(options.location);
  }
  
  return yield* ensureContext(CacheContext, init());
}

export function* useCache(): Operation<Cache> {
  return yield* CacheContext.expect();
}

export function createPersistentCache(options: InitCacheContextOptions): Cache {
  return new PersistantCache(options.location)
}

class PersistantCache implements Cache {
  constructor(public location: URL) {}

  *has(key: string) {
    const location = new URL(`./${key}.jsonl`, this.location);

    return yield* call(() => exists(location));
  }

  *read<T>(key: string) {
    const location = new URL(`./${key}.jsonl`, this.location);
    const file = yield* call(() => Deno.open(location, { read: true }));

    const lines = file
      .readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new JSONLinesParseStream());

    return stream(lines as ReadableStream<T>);
  }

  *write(key: string, data: unknown) {
    const location = new URL(`./${key}.jsonl`, this.location);
    yield* call(() => ensureFile(location));

    const file = yield* call(() =>
      Deno.open(location, {
        append: true,
      })
    );

    try {
      yield* call(() =>
        file.write(new TextEncoder().encode(`${JSON.stringify(data)}\n`))
      );
    } finally {
      file.close();
    }
  }

  *find<T>(glob: string): Operation<Queue<T, void>> {
    const queue = createQueue<T, void>();

    const reg = globToRegExp(`${this.location.pathname}/${glob}`, {
      globstar: true,
    });

    const files = walkSync(this.location, {
      includeDirs: false,
      includeFiles: true,
      match: [
        reg,
      ],
    });

    const { location } = this;
    const read = this.read.bind(this);

    yield* spawn(function* () {
      for (const file of files) {
        const key = join(
          dirname(file.path.replace(location.pathname, "")),
          basename(file.name, ".jsonl"),
        );
        const items = yield* read<T>(key);

        const subscription = yield* items;
        let next = yield* subscription.next();
        while (!next.done) {
          queue.add(next.value);
          next = yield* subscription.next();
        }
      }

      queue.close();
    });

    return queue;
  }

  *clear() {
    yield* call(() => emptyDir(this.location));
  }
}
