import { appConnection } from "../../infrastructure/mongo/mongo.service";
import { blogSchema } from "./blog.schema";
import type { Blog } from "./blog.types";

export const BlogModel = appConnection.model<Blog>("Blog", blogSchema);
