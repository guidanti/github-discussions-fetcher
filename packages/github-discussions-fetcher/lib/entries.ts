import { Comment, Discussion, Reply } from "../types.ts";
import { useCache } from "./useCache.ts";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";

export function* writeDiscussion(item: Discussion) {
  const cache = yield* useCache();
  const key = `discussions/${item.number}`;
  if (!(yield* cache.has(key))) {
    yield* cache.write(
      `discussions/${item.number}`,
      item,
    );
  }
}

export function* writeComment(item: Comment) {
  const cache = yield* useCache();

  const key = `/discussions/${item?.discussionNumber}/${
    encodeHex(md5(item.id))
  }`;
  if (!(yield* cache.has(key))) {
    yield* cache.write(
      key,
      item,
    );
    yield* cache.write(
      `/discussions/${item?.discussionNumber}`,
      item,
    );
  }
}

export function* writeReply(item: Reply) {
  const cache = yield* useCache();

  const key = `/discussions/${item?.discussionNumber}/${
    encodeHex(md5(item.parentCommentId))
  }/${encodeHex(md5(item.id))}`;
  if (!(yield* cache.has(key))) {
    yield* cache.write(
      key,
      item,
    );
    yield* cache.write(
      `/discussions/${item?.discussionNumber}`,
      item,
    );
  }
}
