import { assert } from "jsr:@std/assert";
import { createQueue, main, spawn } from "npm:effection@3.0.3";
import { fetchGithubDiscussions } from "./fetchGithubDiscussions.ts";
import { forEach } from "./lib/forEach.ts";
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

    yield* spawn(function*() {
      yield* fetchGithubDiscussions({
        client,
        org: "vercel",
        repo: "next.js",
        discussionsBatchSize: 75,
        commentsBatchSize: 100,
        repliesBatchSize: 100,
        results,
        logger: console,
        clearCacheOnSuccess: false,
      });
      results.close();
    });

    yield* forEach(function* (result) {
      console.log(result);
    }, results);

    console.log("Done ✅");
  });
}
