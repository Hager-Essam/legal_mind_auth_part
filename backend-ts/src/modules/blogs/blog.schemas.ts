import { z } from "zod";
import { BLOG_CATEGORIES } from "./blog.types";

const editableStatus = z.enum(["draft", "pending", "published"]);
const optionalUrl = z.union([z.string().url(), z.literal("")]).optional();
const tags = z.array(z.string().trim().min(1).max(50)).max(10).optional();

export const createBlogSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    content: z.string().trim().min(20).max(100_000),
    excerpt: z.string().trim().max(500).optional(),
    coverImage: optionalUrl,
    category: z.enum(BLOG_CATEGORIES),
    tags,
    status: editableStatus.optional(),
  })
  .strict();

export const updateBlogSchema = createBlogSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one blog field must be supplied.",
});

export const updateBlogStatusSchema = z
  .object({
    status: z.enum(["draft", "pending", "published", "rejected"]),
    rejectionReason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "rejected" && !value.rejectionReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "A rejection reason is required when rejecting a blog.",
      });
    }
  });

export const listBlogsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(["newest", "popular"]).default("newest"),
    search: z.string().trim().min(1).max(200).optional(),
    category: z.enum(BLOG_CATEGORIES).optional(),
    tags: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const listMyBlogsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export const limitedListSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(50).default(5) })
  .strict();

export type CreateBlogInput = z.infer<typeof createBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;
