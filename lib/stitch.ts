import { type Operation, type Queue } from "npm:effection@4.0.0-alpha.2";
import { DiscussionEntries, GithubDiscussionFetcherResult } from "../types.ts";
import { useCache } from "./useCache.ts";
import { useLogger } from "./useLogger.ts";
import { forEach } from "./forEach.ts";

export function* stitch(
  { results }: { results: Queue<GithubDiscussionFetcherResult, void> },
): Operation<
  void
> {
  const cache = yield* useCache();
  const logger = yield* useLogger();

  const discussions = yield* cache.find<DiscussionEntries>(
    "discussions/*",
  );

  let result: GithubDiscussionFetcherResult | undefined;

  yield* forEach(function* (item) {
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
  }, discussions);

  if (result) {
    results.add(result);
  } else {
    logger.error(`Was expecting the last discussion result in the stitcher`);
  }
}
