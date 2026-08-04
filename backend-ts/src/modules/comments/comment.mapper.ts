const plain = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function") {
    return value.toObject() as Record<string, unknown>;
  }

  return (value ?? {}) as Record<string, unknown>;
};

export const toCommentResponse = (value: unknown) => {
  const comment = plain(value);
  const id = String(comment._id ?? comment.id ?? "");
  const author = plain(comment.author);
  const authorId = String(author._id ?? author.id ?? comment.author ?? "");

  return {
    id,
    _id: id,
    content: comment.content,
    author: {
      id: authorId,
      _id: authorId,
      fullName: author.fullName,
      avatarUrl: author.avatarUrl ?? null,
    },
    blog: String(comment.blog ?? ""),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
};
