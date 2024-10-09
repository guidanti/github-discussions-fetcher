import {
  type Channel,
  createChannel,
  type Operation,
} from "npm:effection@3.0.3";
import { DiscussionEntries } from "../types.ts";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { CommentCursor } from "./discussion.ts";

interface fetchCommentsOptions {
  incompleteComments: CommentCursor[];
  first?: number;
}

export function* fetchComments({
  incompleteComments,
  first = 50,
}: fetchCommentsOptions): Operation<Channel<DiscussionEntries, void>> {
  const graphql = yield* useGraphQL();
  const channel = createChannel<DiscussionEntries>();

  let cursors: CommentCursor[] = incompleteComments;

  do {
    console.log(`Batch querying ${cursors.length} discussions for additional comments`);
    const data: BatchQuery = yield* graphql(
      `query BatchedComments {
        ${
        cursors.map((item, index) => `
        _${index}: node(id: "${item.discussionId}") {
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

    for (const [_, discussion] of Object.entries(data)) {
      if (discussion.comments.pageInfo.hasNextPage) {
        cursors.push({
          discussionId: discussion.id,
          first,
          totalCount: discussion.comments.totalCount,
          endCursor: discussion.comments.pageInfo.endCursor,
        });
      }
      for (const comment of discussion.comments.nodes) {
        if (comment?.author) {
          yield* channel.send({
            type: "comment",
            id: comment.id,
            bodyText: comment.bodyText,
            author: comment.author.login,
            discussionNumber: comment.discussion.number,
          });
        } else {
          console.log(
            `Skipped comment:${comment?.id} because author login is missing.`,
          );
        }
      };
    }
  } while (cursors.length > 0);

  console.log("Finished getting all comments ✅");
  return channel;
}

interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
} // 🚨

type BatchQuery = {
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
  }
} & RateLimit; // 🚨
