const plain = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function") {
    return value.toObject() as Record<string, unknown>;
  }

  return (value ?? {}) as Record<string, unknown>;
};

const authorResponse = (value: unknown) => {
  if (!value || typeof value !== "object") return value ? String(value) : null;
  const author = plain(value);
  const id = String(author._id ?? author.id ?? "");

  return {
    id,
    _id: id,
    fullName: author.fullName,
    email: author.email,
    officeName: author.officeName,
    teamSize: author.teamSize,
    avatarUrl: author.avatarUrl ?? null,
  };
};

export const toBlogResponse = (value: unknown, isBookmarked?: boolean) => {
  const blog = plain(value);
  const id = String(blog._id ?? blog.id ?? "");
  const content = String(blog.content ?? "");

  return {
    id,
    _id: id,
    title: blog.title,
    content,
    excerpt: blog.excerpt,
    coverImage: blog.coverImage ?? null,
    category: blog.category,
    tags: blog.tags ?? [],
    author: authorResponse(blog.author),
    status: blog.status,
    views: blog.views ?? 0,
    bookmarksCount: blog.bookmarksCount ?? 0,
    likesCount: blog.likesCount ?? 0,
    ...(isBookmarked === undefined ? {} : { isBookmarked }),
    readingTime: Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200)),
    rejectionReason: blog.rejectionReason,
    publishedAt: blog.publishedAt,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
  };
};
