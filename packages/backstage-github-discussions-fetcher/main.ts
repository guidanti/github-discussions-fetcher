import { assert } from "jsr:@std/assert";
import {
  each,
  main,
  stream,
} from "npm:effection@4.0.0-alpha.3";
import { createGithubGraphqlClient } from "github-discussions-fetcher";
import { fetchDiscussionDocuments } from './lib/fetchDiscussionDocuments.ts';

if (import.meta.main) {
  await main(function* () {
    const token = Deno.env.get("GITHUB_TOKEN");
    
    assert(
      token,
      "You need to have GITHUB_TOKEN configured in your local environment",
    );

    const client = createGithubGraphqlClient({
      endpoint: "https://api.github.com/graphql",
      token,
    });

    const discussionDocuments = stream(fetchDiscussionDocuments({
      client,
      org: "guidanti",
      repo: "github-discussions-fetcher",
      discussionsBatchSize: 100,
      commentsBatchSize: 100,
      repliesBatchSize: 100,
      logger: console,
      clearCacheOnSuccess: false,
    }));

    for (const document of yield* each(discussionDocuments)) {
      console.log(document);
      yield* each.next();
    }
  });
}
