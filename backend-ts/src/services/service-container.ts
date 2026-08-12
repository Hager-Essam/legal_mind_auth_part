import { EmbeddingService } from "../infrastructure/embeddings/embedding.service";
import { GenerationService } from "../modules/legal-query/generation.service";
import { ClassifierService } from "../modules/legal-query/classifier.service";
import { LegalRefService } from "../modules/legal-query/legal-ref.service";
import { QueryService } from "../modules/legal-query/query.service";
import { QueryRewriteService } from "../modules/legal-query/query-rewrite.service";
import { MongoService } from "../infrastructure/mongo/mongo.service";
import { ProviderConfigService } from "../infrastructure/provider/provider-config.service";
import { RerankerService } from "../modules/legal-query/reranker.service";
import { RetrievalService } from "../modules/legal-corpus/retrieval.service";
import { UserRepository } from "../modules/auth/users/user.repository";
import { RefreshTokenRepository } from "../modules/auth/refresh-tokens/refresh-token.repository";
import { EmailService } from "../infrastructure/email/email.service";
import { AuthService } from "../modules/auth/auth.service";
import { ConversationService } from "../modules/conversations/conversation.service";
import { ConversationMemoryService } from "../modules/conversations/conversation-memory.service";
import { SourceSnapshotService } from "../modules/conversations/source-snapshot.service";
import { ChatOrchestratorService } from "../modules/conversations/chat-orchestrator.service";
import { R2AvatarStorage } from "../infrastructure/storage/avatar-storage.service";
import { R2BlogImageStorage } from "../infrastructure/storage/blog-image-storage.service";
import { UserProfileService } from "../modules/users/user-profile.service";
import { BookmarkRepository } from "../modules/bookmarks/bookmark.repository";
import { BookmarkService } from "../modules/bookmarks/bookmark.service";
import { BlogRepository } from "../modules/blogs/blog.repository";
import { BlogService } from "../modules/blogs/blog.service";
import { CommentRepository } from "../modules/comments/comment.repository";
import { CommentService } from "../modules/comments/comment.service";
import { DashboardRepository } from "../modules/dashboard/dashboard.repository";
import { DashboardService } from "../modules/dashboard/dashboard.service";

export type AppServices = {
  mongoService: MongoService;
  providerConfigService: ProviderConfigService;
  embeddingService: EmbeddingService;
  retrievalService: RetrievalService;
  rerankerService: RerankerService;
  generationService: GenerationService;
  classifierService: ClassifierService;
  legalRefService: LegalRefService;
  queryRewriteService: QueryRewriteService;
  queryService: QueryService;
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  emailService: EmailService;
  authService: AuthService;
  conversationService: ConversationService;
  conversationMemoryService: ConversationMemoryService;
  sourceSnapshotService: SourceSnapshotService;
  chatOrchestratorService: ChatOrchestratorService;
  avatarStorageService: R2AvatarStorage;
  blogImageStorageService: R2BlogImageStorage;
  userProfileService: UserProfileService;
  bookmarkRepository: BookmarkRepository;
  bookmarkService: BookmarkService;
  blogRepository: BlogRepository;
  blogService: BlogService;
  commentRepository: CommentRepository;
  commentService: CommentService;
  dashboardRepository: DashboardRepository;
  dashboardService: DashboardService;
};

export const createServices = (): AppServices => {
  const mongoService = new MongoService();
  const providerConfigService = new ProviderConfigService();
  const embeddingService = new EmbeddingService(providerConfigService);
  const retrievalService = new RetrievalService(embeddingService);
  const rerankerService = new RerankerService(providerConfigService);
  const generationService = new GenerationService(providerConfigService);
  const classifierService = new ClassifierService();
  const legalRefService = new LegalRefService();
  const queryRewriteService = new QueryRewriteService();
  const queryService = new QueryService(
    providerConfigService,
    classifierService,
    legalRefService,
    retrievalService,
    rerankerService,
    generationService,
    queryRewriteService
  );
  const userRepository = new UserRepository();
  const refreshTokenRepository = new RefreshTokenRepository();
  const emailService = new EmailService();
  const authService = new AuthService(userRepository, refreshTokenRepository, emailService);
  const conversationService = new ConversationService();
  const conversationMemoryService = new ConversationMemoryService();
  const sourceSnapshotService = new SourceSnapshotService();
  const chatOrchestratorService = new ChatOrchestratorService(
    conversationService,
    conversationMemoryService,
    sourceSnapshotService,
    queryService
  );
  const avatarStorageService = new R2AvatarStorage();
  const blogImageStorageService = new R2BlogImageStorage();
  const userProfileService = new UserProfileService(userRepository, avatarStorageService);
  const bookmarkRepository = new BookmarkRepository();
  const bookmarkService = new BookmarkService(bookmarkRepository);
  const blogRepository = new BlogRepository();
  const commentRepository = new CommentRepository();
  const blogService = new BlogService(blogRepository, bookmarkRepository, commentRepository);
  const commentService = new CommentService(commentRepository, blogRepository);
  const dashboardRepository = new DashboardRepository();
  const dashboardService = new DashboardService(dashboardRepository);

  return {
    mongoService,
    providerConfigService,
    embeddingService,
    retrievalService,
    rerankerService,
    generationService,
    classifierService,
    legalRefService,
    queryRewriteService,
    queryService,
    userRepository,
    refreshTokenRepository,
    emailService,
    authService,
    conversationService,
    conversationMemoryService,
    sourceSnapshotService,
    chatOrchestratorService,
    avatarStorageService,
    blogImageStorageService,
    userProfileService,
    bookmarkRepository,
    bookmarkService,
    blogRepository,
    blogService,
    commentRepository,
    commentService,
    dashboardRepository,
    dashboardService,
  };
};
