import type { GithubGraphqlClient } from 'npm:github-discussions-fetcher';

export interface FetchDiscussionDocumentsParams {
  client: GithubGraphqlClient;
  org: string;
  repo: string;
  discussionsBatchSize: number;
  commentsBatchSize: number;
  repliesBatchSize: number;
  logger: typeof console;
  cache?: URL;
  timeout?: number;
  clearCacheOnSuccess?: boolean;
}
