import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IComment extends Document {
  content: string;
  author: mongoose.Types.ObjectId;
  blog: mongoose.Types.ObjectId;
  isAuthor(userId: any): boolean;
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment must be at least 1 character'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blog: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ blog: 1, createdAt: -1 });

commentSchema.methods.isAuthor = function (this: IComment, userId: any) {
  return this.author.toString() === userId.toString();
};

const Comment: Model<IComment> = mongoose.model<IComment>('Comment', commentSchema);

export default Comment;
