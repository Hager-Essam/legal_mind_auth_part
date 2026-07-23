const Comment = require('./comment.model');

class CommentRepository {
  async create(commentData) {
    const comment = new Comment(commentData);
    return await comment.save();
  }

  async findById(id) {
    return await Comment.findById(id).populate('author', 'fullName avatar');
  }

  async findByBlog(blogId, page = 1, limit = 20) {
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

  async update(id, updateData) {
    return await Comment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('author', 'fullName avatar');
  }

  async delete(id) {
    return await Comment.findByIdAndDelete(id);
  }

  async countByBlog(blogId) {
    return await Comment.countDocuments({ blog: blogId });
  }

  async deleteByBlog(blogId) {
    return await Comment.deleteMany({ blog: blogId });
  }
}

module.exports = new CommentRepository();
