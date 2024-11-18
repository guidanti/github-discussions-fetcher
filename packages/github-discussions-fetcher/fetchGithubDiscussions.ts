import { type Operation, type Queue } from "npm:effection@4.0.0-alpha.3";
import { fetchDiscussions } from "./fetchers/discussion.ts";
import { initCacheContext } from "./lib/useCache.ts";
import { GithubGraphqlClient, initGraphQLContext } from "./lib/useGraphQL.ts";
import { fetchComments } from "./fetchers/comments.ts";
import { fetchReplies } from "./fetchers/replies.ts";
import { Cursor, GithubDiscussionFetcherResult } from "./types.ts";
import { initLoggerContext } from "./lib/useLogger.ts";
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
    timeout = 360_000,
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
  logger.log(
    `Total GraphQL cost for fetching all discussions: ${summary.cost}`,
  );
  logger.log(`Total number of queries: ${summary.queryCount}`);

  yield* stitch({ results });

  if (clearCacheOnSuccess) {
    logger.log(`Clearing cache`);
    yield* cache.clear();
  }
}
