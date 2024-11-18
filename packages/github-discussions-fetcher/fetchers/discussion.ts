import { assert } from "jsr:@std/assert@1.0.3";
import { type Operation } from "npm:effection@4.0.0-alpha.3";
import type { DiscussionsQuery } from "../__generated__/types.ts";
import { writeComment, writeDiscussion } from "../lib/entries.ts";
import { useGraphQL } from "../lib/useGraphQL.ts";
import type { Cursor, CURSOR_VALUE } from "../types.ts";
import chalk from "npm:chalk@4.1.2";
import { useLogger } from "../lib/useLogger.ts";

interface fetchDiscussionOptions {
  org: string;
  repo: string;
  first: number;
}

export function* fetchDiscussions({
  org,
  repo,
  first,
}: fetchDiscussionOptions): Operation<Cursor[]> {
  const graphql = yield* useGraphQL();
  const logger = yield* useLogger();

  const incompleteComments: Cursor[] = [];
  let hasNextPage: boolean;
  let after: CURSOR_VALUE = undefined;

  let progress = 0;

  do {
    const parameters: {
      owner: string;
      name: string;
      first: number;
      after: CURSOR_VALUE;
    } = {
      owner: org,
      name: repo,
      first,
      after,
    };

    const data = yield* graphql<DiscussionsQuery>(
      DISCUSSIONS_QUERY,
      parameters,
    );

    assert(data.repository, `Could not fetch ${org}/${repo}`);

    logger.log(
      `Fetched ${
        chalk.blue(
          progress += data.repository.discussions.nodes?.length ??
            0,
        )
      } of ${
        chalk.blue(data.repository.discussions.totalCount)
      } discussions for ${JSON.stringify(parameters)}`,
    );
    for (const discussion of data.repository.discussions.nodes ?? []) {
      if (discussion) {
        if (discussion.author) {
          const labels = discussion?.labels?.nodes
            ? discussion.labels.nodes.reduce((acc, label) => {
              if (label) {
                if (label.color && label.name) {
                  return [...acc, {
                    name: label.name,
                    color: label.color,
                  }];
                }
              }
              return acc;
            }, [] as { name: string; color: string }[])
            : [];
          yield* writeDiscussion({
            type: "discussion",
            id: discussion.id,
            number: discussion.number,
            title: discussion.title,
            url: discussion.url,
            bodyText: discussion.bodyText,
            author: discussion.author.login,
            category: discussion.category.name,
            labels,
          });
        } else {
          logger.log(
            chalk.gray(
              `Skipped discussion:${discussion.number} because author login is missing.`,
            ),
          );
        }
        if (discussion.comments.pageInfo.hasNextPage) {
          incompleteComments.push({
            id: discussion.id,
            first,
            endCursor: discussion.comments.pageInfo.endCursor,
          });
        }
        for (const comment of discussion?.comments.nodes ?? []) {
          if (comment?.author) {
            yield* writeComment({
              type: "comment",
              id: comment.id,
              bodyText: comment.bodyText,
              author: comment.author.login,
              discussionNumber: discussion.number,
            });
          } else {
            logger.log(
              chalk.gray(
                `Skipped comment:${comment?.id} because author login is missing.`,
              ),
            );
          }
        }
      } else {
        logger.log(`Received ${discussion} in ${after} of ${org}/${repo}`);
      }
    }
    hasNextPage = !!data.repository.discussions.pageInfo.hasNextPage;
    after = data.repository.discussions.pageInfo.endCursor;
  } while (hasNextPage);

  return incompleteComments;
}

export const DISCUSSIONS_QUERY = /* GraphQL */ `
  query Discussions($name: String!, $owner: String!, $after: String = "", $first: Int!) {
    repository(name: $name, owner: $owner) {
      discussions(first: $first, after: $after, orderBy: {
        field: CREATED_AT,
        direction: ASC,
      }) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          url
          bodyText
          number
          labels (first: 100) {
            nodes {
              name
              color
            }
          }
          author {
            login
          }
          category {
            name
          }
          comments(first: 100) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ...DiscussionComment
            }
          }
        }
      }
    }
    rateLimit {
      cost
      remaining
      nodeCount
    }
  }

  fragment DiscussionComment on DiscussionComment {
    id
    bodyText
    author {
      login
    }
  }
`;
