import { assert } from "jsr:@std/assert@1.0.3";
import { encodeHex } from "jsr:@std/encoding@1";
import { md5 } from "jsr:@takker/md5@0.1.0";
import type { GraphQlQueryResponse } from "npm:@octokit/graphql@^4.8.0/dist-types/types.ts";
import type { RequestParameters } from "npm:@octokit/types@13.6.1";
import chalk from "npm:chalk@4.1.2";
import {
  call,
  createContext,
  each,
  type Operation,
  useAbortSignal,
} from "npm:effection@4.0.0-alpha.3";
import {
  DocumentNode,
  type OperationDefinitionNode,
  parse,
} from "npm:graphql@16.8.2";
import { useRetryWithBackoff } from "./useRetryWithBackoff.ts";

import {
  type Cache,
  CacheContext,
  createPersistentCache,
  useCache,
} from "./useCache.ts";
import { type CostTracker, useCost } from "./useCost.ts";
import { Logger, useLogger } from "./useLogger.ts";

export const GraphQLContext =
  createContext<
    <ResponseData>(
      query: string,
      parameters?: RequestParameters,
    ) => Operation<ResponseData>
  >("graphql");

interface InitGraphQLContextOptions {
  client: GithubGraphqlClient;
}

export function* initGraphQLContext({
  client,
}: InitGraphQLContextOptions): Operation<
  <ResponseData>(
    query: string,
    parameters?: RequestParameters,
  ) => Operation<ResponseData>
> {
  const logger = yield* useLogger();
  const cost = yield* useCost();
  const currentCache = yield* useCache();

  const githubCache = createPersistentCache({
    location: new URL("./github/", currentCache.location),
  });

  const fetchGithubGraphql = yield* CacheContext.with(
    githubCache,
    function* () {
      return createFetchGithubGraphql({
        cache: githubCache,
        client,
        logger,
        cost,
      });
    },
  );

  return yield* GraphQLContext.set(fetchGithubGraphql);
}

export function* useGraphQL(): Operation<<ResponseData>(
  query: string,
  parameters?: RequestParameters,
) => Operation<ResponseData>> {
  return yield* GraphQLContext.expect();
}

interface CreateFetchGithubGraphql {
  cache: Cache;
  logger: Logger;
  client: GithubGraphqlClient;
  cost: CostTracker;
}

function createFetchGithubGraphql({
  cache,
  client,
  logger,
  cost,
}: CreateFetchGithubGraphql) {
  return function* query<ResponseData>(
    query: string,
    parameters: RequestParameters = {},
  ): Operation<ResponseData> {
    const operationName = getOperationName(parse(query));
    const key = `${encodeHex(md5(query))}-${Object.keys(parameters)
      .map((p) => `${p}:${parameters[p]}`)
      .join("-")}`;

    if (yield* cache.has(key)) {
      for (const data of yield* each(yield* cache.read<ResponseData>(key))) {
        return data;
      }
      logger.error(`This could happen if cached document had no records.`);
      return null as ResponseData;
    } else {
      let data: ResponseData | undefined;

      yield* useRetryWithBackoff(
        function* () {
          data = yield* client<ResponseData>({
            query,
            variables: parameters,
          });
        },
        {
          operationName,
        },
      );

      // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
      if (data?.rateLimit) {
        logger.info(
          `GitHub API Query ${operationName} with ${
            JSON.stringify(parameters)
            // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
          } ${chalk.green("cost", data.rateLimit.cost)} and ${
            // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
            chalk.green("remaining", data.rateLimit.remaining)
          }`,
        );
        cost.update({
          // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
          cost: data.rateLimit.cost,
          // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
          nodeCount: data.rateLimit.nodeCount,
          // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
          remaining: data.rateLimit.remaining,
        });
      }

      assert(data, "Could not fetch data from GraphQL API");

      yield* cache.write(key, data);
      return data;
    }
  };
}

export interface GithubGraphqlClientOptions {
  query: string;
  variables: { [key: string]: unknown };
}

export type GithubGraphqlClient = <ResponseData>(
  options: GithubGraphqlClientOptions,
) => Operation<ResponseData>;

export function createGithubGraphqlClient({
  token,
  endpoint,
}: {
  token?: string;
  endpoint: string;
}): GithubGraphqlClient {
  return function* githubGraphqlClient<ResponseData>({
    query,
    variables,
  }: GithubGraphqlClientOptions): Operation<ResponseData> {
    const logger = yield* useLogger();
    const signal = yield* useAbortSignal();

    const response = yield* call(() =>
      fetch(endpoint, {
        method: "POST",
        headers: new Headers({
          Authorization: `token ${token}`,
          "X-Github-Next-Global-ID": "1",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          query,
          variables,
        }),
        signal,
      }),
    );
    if (response.ok) {
      const payload = yield* call<GraphQlQueryResponse<ResponseData>>(() =>
        response.json(),
      );
      if (payload.errors) {
        for (const error of payload.errors ?? []) {
          logger.error(
            `${getOperationName(parse(query))} with ${JSON.stringify(
              variables,
            )} encountered an error ${JSON.stringify(error)}`,
          );
        }
      }
      return payload.data;
    } else {
      throw new Error(`${response.status} ${response.statusText}`);
    }
  };
}

export function getOperationName(doc: DocumentNode): string | null {
  return (
    doc.definitions
      .filter(
        (definition): definition is OperationDefinitionWithName =>
          definition.kind === "OperationDefinition" && !!definition.name,
      )
      .map((x) => x.name.value)[0] || null
  );
}

type OperationDefinitionWithName = OperationDefinitionNode & {
  name: NonNullable<OperationDefinitionNode["name"]>;
};
