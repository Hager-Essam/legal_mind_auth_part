import { appConnection } from "../../infrastructure/mongo/mongo.service";
import { commentSchema } from "./comment.schema";
import type { Comment } from "./comment.types";

export const CommentModel = appConnection.model<Comment>("Comment", commentSchema);
