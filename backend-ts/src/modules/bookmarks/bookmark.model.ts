import { Schema } from "mongoose";
import { appConnection } from "../../infrastructure/mongo/mongo.service";
import { bookmarkSchema, type Bookmark } from "./bookmark.schema";

export const BookmarkModel = appConnection.model<Bookmark>("Bookmark", bookmarkSchema);

// The bookmark feature consumes existing blog records. Blog authoring remains a
// separate module; strict:false lets this read the established legacy shape.
const blogReferenceSchema = new Schema({}, { collection: "blogs", strict: false, versionKey: false });

export const BlogReferenceModel = appConnection.model("BlogReference", blogReferenceSchema);
