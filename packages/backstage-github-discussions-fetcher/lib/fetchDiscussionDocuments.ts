import {
  createQueue,
  createScope,
  type Operation,
  spawn,
  suspend,
} from 'npm:effection@4.0.0-alpha.3';
import {
  fetchGithubDiscussions,
  type GithubDiscussionFetcherResult,
  toAsyncIterable,
} from 'npm:github-discussions-fetcher';
import { FetchDiscussionDocumentsParams } from "../types.ts";

export function fetchDiscussionDocuments(params: FetchDiscussionDocumentsParams) {
  const results = createQueue<GithubDiscussionFetcherResult, void>();
  const [scope] = createScope();

  scope.run(function* (): Operation<void> {
    yield* spawn(function* (): Operation<void> {
      try {
        yield* fetchGithubDiscussions({
          ...params,
          results,
        });
      } catch (e) {
        params.logger.log(e);
        params.logger.error(
          `Encountered an error while ingesting GitHub Discussions`,
          e,
        );
      }
      results.close();
    });

    yield* suspend();
  });

  return toAsyncIterable(results, scope);
}
