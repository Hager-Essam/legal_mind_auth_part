import Comment, { IComment } from './comment.model';

class CommentRepository {
  async create(commentData: Partial<IComment>): Promise<IComment> {
    const comment = new Comment(commentData);
    return await comment.save();
  }

  async findById(id: string): Promise<IComment | null> {
    return await Comment.findById(id).populate('author', 'fullName avatar');
  }

  async findByBlog(blogId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ blog: blogId })
      .populate('author', 'fullName avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ blog: blogId });

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, updateData: Partial<IComment>): Promise<IComment | null> {
    return await Comment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('author', 'fullName avatar');
  }

  async delete(id: string): Promise<IComment | null> {
    return await Comment.findByIdAndDelete(id);
  }

  async countByBlog(blogId: string): Promise<number> {
    return await Comment.countDocuments({ blog: blogId });
  }

  async deleteByBlog(blogId: string) {
    return await Comment.deleteMany({ blog: blogId });
  }
}

export default new CommentRepository();
