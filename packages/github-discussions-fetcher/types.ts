export interface Comment {
  type: "comment";
  id: string;
  bodyText: string;
  author: string;
  discussionNumber: number;
}

export interface Discussion {
  type: "discussion";
  id: string;
  number: number;
  title: string;
  url: string;
  bodyText: string;
  author: string;
  category: string;
  labels: {
    name: string;
    color: string;
  }[];
}

export interface Reply {
  type: "reply";
  id: string;
  bodyText: string;
  author: string;
  parentCommentId: string;
  discussionNumber: number;
}

export interface Cursor {
  id: string;
  first: number;
  endCursor: CURSOR_VALUE;
}

/**
 * Start: undefined
 * Middle: string
 * Last: null
 */
export type CURSOR_VALUE = string | null | undefined;

export interface CommentWithReplies extends Comment {
  replies: Reply[];
}

export interface GithubDiscussionFetcherResult extends Discussion {
  comments: CommentWithReplies[];
}

export type DiscussionEntries =
  | Comment
  | Discussion
  | Reply;
