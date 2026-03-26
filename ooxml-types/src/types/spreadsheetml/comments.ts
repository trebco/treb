import type { OneOrMany, TextElement } from "./util.js";
import type { RichTextRun } from "./sheetData.js";

export interface CommentText {
  t?: TextElement;
  r?: OneOrMany<RichTextRun>;
}

export interface Comment {
  $attributes?: {
    ref: string;
    authorId: number;
    guid?: string;
    shapeId?: number;
  };
  text: CommentText;
}

export interface CommentList {
  comment: OneOrMany<Comment>;
}

export interface Authors {
  author: OneOrMany<TextElement>;
}

export interface Comments {
  authors: Authors;
  commentList: CommentList;
}
