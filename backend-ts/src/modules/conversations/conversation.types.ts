export type ConversationStatus = "active" | "archived" | "deleted";

export type ActiveLegalContext = {
  jurisdiction: "EG";
  authorityIds: string[];
  lawReferences: Array<{
    authorityId?: string;
    officialTitle?: string;
    lawNumber?: string;
    lawYear?: string;
    articleNumbers?: string[];
  }>;
  facts: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
};

export type SourceSnapshot = {
  sourceId: string;
  chunkId: string;
  authorityId?: string;
  authorityTitleOfficial?: string;
  authorityType?: string;
  jurisdiction: string;
  authorityStatus?: string;
  articleNumber?: string;
  lawNumber?: string;
  lawYear?: string;
  appealNumber?: string;
  judicialYear?: string;
  rulingDate?: string;
  sourceDataset?: string;
  sourceFile?: string;
  officialSourceUrl?: string;
  excerpt: string;
  retrievalScore?: number;
  rerankScore?: number;
  corpusReleaseId?: string;
  retrievedAt: Date;
};

export type Conversation = {
  conversationId: string;
  ownerUserId: string;
  organizationId: string | null;
  title: string;
  status: ConversationStatus;
  jurisdiction: "EG";
  summary: string;
  summaryVersion: number;
  activeLegalContext: ActiveLegalContext;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "completed" | "failed" | "cancelled";

export type Message = {
  messageId: string;
  conversationId: string;
  ownerUserId: string;
  organizationId: string | null;
  role: MessageRole;
  status: MessageStatus;
  sequence: number;
  content: string;
  originalQuery?: string;
  retrievalQuery?: string;
  category?: "arabic_rag" | "law_ref" | "chat";
  sourceSnapshot?: SourceSnapshot[];
  diagnostics?: {
    rewriteUsed: boolean;
    rewriteMethod?: "none" | "mapping" | "llm" | "conversation";
    evidenceRelevanceScore?: number;
    citationCoverage?: number;
    latencyMs?: number;
    llmProvider?: string | null;
    llmModel?: string | null;
    corpusReleaseId?: string;
  };
  idempotencyKey?: string;
  error?: { code: string; safeMessage: string };
  createdAt: Date;
  updatedAt: Date;
};
