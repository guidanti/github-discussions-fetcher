import { type Operation } from "npm:effection@4.0.0-alpha.2";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { useCache } from "../lib/useCache.ts";
import { useEntries } from "../lib/useEntries.ts";
import { Comment, Cursor } from "../types.ts";
import chalk from "npm:chalk@4.1.2";
import { useLogger } from "../lib/useLogger.ts";

/**
 * This function fetches all of the replies for existing comments by fetching replies for each comment.
 * Reply queries are batched into batches of a specific size. It batches comment and reply cursors in
 * the same batch query. In other words, it'll attempt to first create a batch that fetches replies for
 * first ${batchSize} comments, then retrieve cursors for comments that have more than ${batchSize} replies and
 * combine the cursor with the next set of comments cursors. It'll repeat this until there are not commments
 * with remaining replies.
 */
export function* fetchReplies({
  first
}: {
  first: number;
}): Operation<void> {
  const cache = yield* useCache();

  let cursors: Cursor[] = [];

  const subscription = yield* cache.find<Comment>("discussions/*/*");
  let next = yield* subscription.next();
  while (!next.done) {
    const comment = next.value;
    cursors.push({
      id: comment.id,
      first,
      endCursor: undefined,
    });
    if (cursors.length >= first) {
      cursors = yield* fetchReplyCursors({ cursors, first });
    }
    next = yield* subscription.next();
  }
  // fetched remaining cursors (assume it'll be less than 50)
  do {
    cursors = yield* fetchReplyCursors({ cursors, first });
  } while (cursors.length > 0);
}

interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
} // 🚨

type CommentsBatchQuery = {
  [key: string]: {
    id: string;
    replies: {
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
        };
      }[];
    };
  };
} & RateLimit; // 🚨

function* fetchReplyCursors(
  { cursors, first }: { cursors: Cursor[]; first: number },
) {
  const entries = yield* useEntries();
  const graphql = yield* useGraphQL();
  const logger = yield* useLogger();

  const data = yield* graphql<CommentsBatchQuery>(
    `query BatchedComments {
      ${
      cursors.map((item, index) => `
      _${index}: node(id: "${item.id}") {
      ... on DiscussionComment {
        id
        replies(first: ${item.first}${
        item.endCursor !== undefined ? `, after: "${item.endCursor}"` : ""
      }) {
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

  const newCursors: Cursor[] = [];
  delete data.rateLimit;

  for (const [_, comment] of Object.entries(data)) {
    if (comment.replies.pageInfo.hasNextPage) {
      newCursors.push({
        id: comment.id,
        first,
        endCursor: comment.replies.pageInfo.endCursor,
      });
    }
    for (const reply of comment.replies.nodes) {
      if (reply?.author) {
        yield* entries.send({
          type: "reply",
          id: reply.id,
          bodyText: reply.bodyText,
          author: reply.author.login,
          parentCommentId: comment.id,
          discussionNumber: reply.discussion.number,
        });
      } else {
        logger.log(
          chalk.gray(
            `Skipped comment:${comment?.id} because author login is missing.`,
          ),
        );
      }
    }
  }
  return newCursors;
}
