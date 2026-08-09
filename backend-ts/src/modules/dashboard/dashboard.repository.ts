import { Types } from "mongoose";
import { Job } from "../contract-analysis/models/job.model";
import { GenerationJob } from "../contract-generation/models/generation-job.model";
import { ResultsAnalysis } from "../contract-analysis/models/results-analysis.model";
import { GeneratedContract } from "../contract-generation/models/generated-contract.model";
import { BlogModel } from "../blogs/blog.model";
import { ConversationModel } from "../conversations/conversation.model";
import { MessageModel } from "../conversations/message.model";
import { CommentModel } from "../comments/comment.model";
import { BookmarkModel } from "../bookmarks/bookmark.model";

export type RawActivityRow = {
  _id: string;
  type: string;
  timestamp: Date;
  title?: string;
  content?: string;
  originalFileName?: string;
  fileType?: string;
  status?: string;
  prompt?: string;
  contractType?: string;
  language?: string;
  category?: string;
  blogTitle?: string;
  blogCategory?: string;
  messageCount?: number;
  overallScore?: number;
  classification?: string;
  topRisks?: string[];
  complianceScore?: number;
  totalClauses?: number;
  compliantClauses?: number;
};

export class DashboardRepository {
  async findAnalysisJobs(userId: string, start: Date, end: Date): Promise<RawActivityRow[]> {
    const jobs = await Job.find({
      userId,
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!jobs.length) return [];

    const jobIds = jobs.map((j) => j.id);
    const analyses = await ResultsAnalysis.find({ jobId: { $in: jobIds } })
      .select("jobId overall.overall_score overall.classification overall.top_risks overall.breakdown clauses metadata.totalClauses")
      .lean();

    const analysisMap = new Map(analyses.map((a) => [a.jobId, a]));

    return jobs.map((job) => {
      const analysis = analysisMap.get(job.id);
      return {
        _id: job.id,
        type: "analysis",
        timestamp: job.createdAt,
        originalFileName: job.originalFileName,
        fileType: job.fileType,
        status: job.status,
        overallScore: analysis?.overall?.overall_score,
        classification: analysis?.overall?.classification,
        topRisks: analysis?.overall?.top_risks,
        totalClauses: analysis?.metadata?.totalClauses,
      };
    });
  }

  async findGenerationJobs(userId: string, start: Date, end: Date): Promise<RawActivityRow[]> {
    const jobs = await GenerationJob.find({
      userId,
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!jobs.length) return [];

    const jobIds = jobs.map((j) => j.id);
    const contracts = await GeneratedContract.find({ jobId: { $in: jobIds } })
      .select("jobId validationResult.compliant validationResult.score validationResult.compliantClauses validationResult.totalClauses")
      .lean();

    const contractMap = new Map(contracts.map((c) => [c.jobId, c]));

    return jobs.map((job) => {
      const contract = contractMap.get(job.id);
      return {
        _id: job.id,
        type: "generation",
        timestamp: job.createdAt,
        prompt: job.prompt,
        contractType: job.contractType,
        language: job.language,
        status: job.status,
        complianceScore: contract?.validationResult?.score,
        totalClauses: contract?.validationResult?.totalClauses,
        compliantClauses: contract?.validationResult?.compliantClauses,
      };
    });
  }

  async findBlogs(userId: string, start: Date, end: Date): Promise<RawActivityRow[]> {
    const authorId = new Types.ObjectId(userId);
    const blogs = await BlogModel.find({
      author: authorId,
      createdAt: { $gte: start, $lte: end },
    })
      .select("title category status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return blogs.map((blog) => ({
      _id: blog._id.toString(),
      type: "blog",
      timestamp: blog.createdAt,
      title: blog.title,
      category: blog.category,
      status: blog.status,
    }));
  }

  async findConversations(userId: string, start: Date, end: Date): Promise<RawActivityRow[]> {
    const conversations = await ConversationModel.find({
      ownerUserId: userId,
      createdAt: { $gte: start, $lte: end },
      status: { $ne: "deleted" },
    })
      .select("title messageCount createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return conversations.map((conv) => ({
      _id: conv.conversationId,
      type: "conversation",
      timestamp: conv.createdAt,
      title: conv.title,
      messageCount: conv.messageCount,
    }));
  }

  async findBookmarks(userId: string, start: Date, end: Date): Promise<RawActivityRow[]> {
    const bookmarks = await BookmarkModel.find({
      ownerUserId: userId,
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!bookmarks.length) return [];

    const blogIds = bookmarks.map((b) => b.blogId);
    const blogs = await BlogModel.find({ _id: { $in: blogIds } })
      .select("title category")
      .lean();

    const blogMap = new Map(blogs.map((b) => [b._id.toString(), b]));

    return bookmarks.map((bm) => {
      const blog = blogMap.get(bm.blogId.toString());
      return {
        _id: bm.bookmarkId,
        type: "bookmark",
        timestamp: bm.createdAt,
        blogTitle: blog?.title,
        blogCategory: blog?.category,
      };
    });
  }

  async findComments(userId: string, start: Date, end: Date): Promise<RawActivityRow[]> {
    const authorId = new Types.ObjectId(userId);
    const comments = await CommentModel.find({
      author: authorId,
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!comments.length) return [];

    const blogIds = comments.map((c) => c.blog);
    const blogs = await BlogModel.find({ _id: { $in: blogIds } })
      .select("title category")
      .lean();

    const blogMap = new Map(blogs.map((b) => [b._id.toString(), b]));

    return comments.map((cm) => {
      const blog = blogMap.get(cm.blog.toString());
      return {
        _id: cm._id.toString(),
        type: "comment",
        timestamp: cm.createdAt,
        content: cm.content,
        blogTitle: blog?.title,
        blogCategory: blog?.category,
      };
    });
  }
}
