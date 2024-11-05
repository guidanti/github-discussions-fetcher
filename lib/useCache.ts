import { ensureFile, exists, walk, emptyDir } from "jsr:@std/fs@1.0.4";
import { basename, dirname, globToRegExp, join } from "jsr:@std/path@1.0.6";
import {
  call,
  createContext,
  createQueue,
  type Operation,
  spawn,
  type Stream,
  stream,
  each,
} from "npm:effection@4.0.0-alpha.3";

import { ensureContext } from "./ensureContext.ts";
import { JSONLinesParseStream } from './jsonlines/parser.ts';

export interface Cache {
  location: URL;
  write(key: string, data: unknown): Operation<void>;
  read<T>(key: string): Operation<Stream<T, unknown>>;
  has(key: string): Operation<boolean>;
  find<T>(directory: string): Stream<T, void>;
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

    return yield* call(async () => {
      try {
        return await exists(location);
      } catch {
        return false;
      };
    });
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

  *find<T>(glob: string): Stream<T, void> {
    const queue = createQueue<T, void>();

    const reg = globToRegExp(`${this.location.pathname}/${glob}`, {
      globstar: true,
    });

    const files = walk(this.location, {
      includeDirs: false,
      includeFiles: true,
      match: [
        reg,
      ],
    });

    const { location } = this;
    const read = this.read.bind(this);

    yield* spawn(function* () {
      for (const file of yield* each(stream(files))) {
        const key = join(
          dirname(file.path.replace(location.pathname, "")),
          basename(file.name, ".jsonl"),
        );

        const items = yield* read<T>(key);
        for (const item of yield* each(items)) {
          queue.add(item);
          yield* each.next();
        }

        yield* each.next();
      }

      queue.close();
    });

    return queue;
  }

  *clear() {
    yield* call(() => emptyDir(this.location));
  }
}
