import { assert } from "jsr:@std/assert";
import {
  createQueue,
  each,
  main,
  type Operation,
  spawn,
  type Subscription,
} from "npm:effection@4.0.0-alpha.2";
import byteSize from "npm:byte-size@9.0.0";
import { fetchGithubDiscussions } from "./fetchGithubDiscussions.ts";
import { createGithubGraphqlClient } from "./lib/useGraphQL.ts";
import type { GithubDiscussionFetcherResult } from "./types.ts";

if (import.meta.main) {
  await main(function* () {
    const token = Deno.env.get("GITHUB_TOKEN");
    const results = createQueue<GithubDiscussionFetcherResult, void>();

    assert(
      token,
      "You need to have GITHUB_TOKEN configured in our local environment",
    );

    const client = createGithubGraphqlClient({
      endpoint: "https://api.github.com/graphql",
      token,
    });

    yield* spawn(function* () {
      yield* fetchGithubDiscussions({
        client,
        org: "vercel",
        repo: "next.js",
        discussionsBatchSize: 100,
        commentsBatchSize: 100,
        repliesBatchSize: 100,
        results,
        logger: console,
        clearCacheOnSuccess: false,
      });
      results.close();
    });

    // deno-lint-ignore require-yield
    function* createResultsSubscription(): Operation<
      Subscription<GithubDiscussionFetcherResult, void>
    > {
      return results;
    }

    for (
      const result of yield* each(
        createResultsSubscription(),
      )
    ) {
      console.log(result);
      yield* each.next();
    }

    const memory = Deno.memoryUsage();

    console.log(`Done ✅; Used ${byteSize(memory.rss)} of memory.`);
  });
}
