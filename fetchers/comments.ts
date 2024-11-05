import { type Operation } from "npm:effection@4.0.0-alpha.3";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { useEntries } from "../lib/useEntries.ts";
import { Cursor } from "../types.ts";
import chalk from "npm:chalk@4.1.2";
import { useLogger } from "../lib/useLogger.ts";

interface fetchCommentsOptions {
  incompleteComments: Cursor[];
  first: number;
}

export function* fetchComments({
  incompleteComments,
  first,
}: fetchCommentsOptions): Operation<void> {
  const entries = yield* useEntries();
  const graphql = yield* useGraphQL();
  const logger = yield* useLogger();

  let cursors: Cursor[] = incompleteComments;

  do {
    logger.log(
      `Batch querying ${chalk.blue(cursors.length, cursors.length > 1 ? "discussions" : "discussion")} for additional comments`,
    );
    const data: DiscussionsBatchQuery = yield* graphql(
      `query BatchedComments {
        ${
        cursors.map((item, index) => `
        _${index}: node(id: "${item.id}") {
        ... on Discussion {
          id
          comments(first: ${item.first}, after: "${item.endCursor}") {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              bodyText
              author {
                login
              }
              discussion {
                number
              }
            }
          }
        }
      }
    `).join("\n")
      }
        rateLimit {
          cost
          remaining
          nodeCount
        }
      }`,
      {},
    );

    delete data.rateLimit;
    cursors = []

    let commentsCount = 0;
    for (const [_, discussion] of Object.entries(data)) {
      if (discussion) {
        if (discussion.comments.pageInfo.hasNextPage) {
          cursors.push({
            id: discussion.id,
            first,
            endCursor: discussion.comments.pageInfo.endCursor,
          });
        }
        commentsCount += discussion.comments.nodes.length;
        for (const comment of discussion.comments.nodes) {
          if (comment?.author) {
            yield* entries.send({
              type: "comment",
              id: comment.id,
              bodyText: comment.bodyText,
              author: comment.author.login,
              discussionNumber: comment.discussion.number,
            });
          } else {
            logger.log(
              chalk.gray(`Skipped comment:${comment?.id} because author login is missing.`),
            );
          }
        };
      }
    }
    logger.log(
      `Retrieved ${chalk.blue(commentsCount, commentsCount > 1 ? "comments" : "comment")} from batch query`,
    );
  } while (cursors.length > 0);
}

interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
} // 🚨

type DiscussionsBatchQuery = {
  [key: string]: {
    id: string;
    comments: {
      totalCount: number;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
      nodes: {
        id: string;
        bodyText: string;
        author: {
          login: string;
        };
        discussion: {
          number: number;
        }
      }[];
    }
  } | null;
} & RateLimit; // 🚨
