import { each, type Operation, type Queue } from "npm:effection@4.0.0-alpha.3";
import { DiscussionEntries, GithubDiscussionFetcherResult } from "../types.ts";
import { useCache } from "./useCache.ts";
import { useLogger } from "./useLogger.ts";

export function* stitch(
  { results }: { results: Queue<GithubDiscussionFetcherResult, void> },
): Operation<
  void
> {
  const cache = yield* useCache();
  const logger = yield* useLogger();

  let result: GithubDiscussionFetcherResult | undefined;

  for (
    const item of yield* each(cache.find<DiscussionEntries>(
      "discussions/*",
    ))
  ) {
    switch (item.type) {
      case "discussion": {
        if (result && result.number !== item.number) {
          // encountered next discussion
          // emit the discussion before i
          results.add(result);
        }
        result = {
          ...item,
          comments: [],
        };
        break;
      }
      case "comment": {
        if (result) {
          result.comments.push({
            ...item,
            replies: [],
          });
        } else {
          logger.error(
            `Do not have a reference to the discussion for comment[${item.id}]`,
          );
        }
        break;
      }
      case "reply": {
        if (result) {
          const comment = result.comments.find((comment) =>
            comment.id === item.parentCommentId
          );
          if (comment) {
            comment.replies.push(item);
          } else {
            logger.error(
              "Could not find comment for a reply, possibly, because the author account was deleted.",
            );
          }
        } else {
          logger.error(
            `Do not have a reference to the discussion for reply[${item.id}]`,
          );
        }
        break;
      }
    }
    yield* each.next();
  }

  if (result) {
    results.add(result);
  } else {
    logger.error(`Was expecting the last discussion result in the stitcher`);
  }
}
