import { each, type Operation, type Queue, spawn } from "npm:effection@3.0.3";
import { fetchDiscussions } from "./fetchers/discussion.ts";
import { initCacheContext } from "./lib/useCache.ts";
import { GithubGraphqlClient, initGraphQLContext } from "./lib/useGraphQL.ts";
import { fetchComments } from "./fetchers/comments.ts";
import { fetchReplies } from "./fetchers/replies.ts";
import { initEntriesContext } from "./lib/useEntries.ts";
import { Cursor, GithubDiscussionFetcherResult } from "./types.ts";
import { initLoggerContext } from "./lib/useLogger.ts";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";
import { initRetryWithBackoff } from "./lib/useRetryWithBackoff.ts";
import { stitch } from "./lib/stitch.ts";
import { initCostContext } from "./lib/useCost.ts";

export interface FetchGithubDiscussionsOptions {
  client: GithubGraphqlClient;
  org: string;
  repo: string;
  discussionsBatchSize: number;
  commentsBatchSize: number;
  repliesBatchSize: number;
  results: Queue<GithubDiscussionFetcherResult, void>;
  logger: typeof console;
  cache?: URL;
  timeout?: number;
  clearCacheOnSuccess?: boolean;
}

export function* fetchGithubDiscussions(
  options: FetchGithubDiscussionsOptions,
): Operation<void> {
  const {
    client,
    org,
    repo,
    discussionsBatchSize,
    commentsBatchSize,
    repliesBatchSize,
    results,
    timeout = 90_000,
    clearCacheOnSuccess = true,
  } = options;

  yield* initRetryWithBackoff({
    timeout,
    operationName: "Unknown",
  });

  const logger = yield* initLoggerContext(options.logger);
  const cost = yield* initCostContext();
  const cache = yield* initCacheContext({
    location: options.cache ?? new URL(`./.cache/`, import.meta.url),
  });

  yield* initGraphQLContext({ client });

  const entries = yield* initEntriesContext();

  yield* spawn(function* () {
    for (const item of yield* each(entries)) {
      switch (item.type) {
        case "discussion": {
          const key = `discussions/${item.number}`;
          if (!(yield* cache.has(key))) {
            yield* cache.write(
              `discussions/${item.number}`,
              item,
            );
          }
          break;
        }
        case "comment": {
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
          break;
        }
        case "reply": {
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
          break;
        }
      }
      yield* each.next();
    }
  });

  const incompleteComments: Cursor[] = yield* fetchDiscussions({
    org,
    repo,
    first: discussionsBatchSize,
  });

  yield* fetchComments({
    incompleteComments,
    first: commentsBatchSize,
  });

  yield* fetchReplies({
    first: repliesBatchSize,
  });

  const summary = cost.summary();
  logger.log(`Total GraphQL cost for fetching all discussions: ${summary.cost}`);
  logger.log(`Total number of queries: ${summary.queryCount}`);

  yield* stitch({ results });
  
  if (clearCacheOnSuccess) {
    logger.log(`Clearing cache`);
    yield* cache.clear();
  }
}
