export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  role: "user" | "pending_lawyer" | "lawyer" | "admin";
  officeName?: string;
  isEmailVerified: boolean;
};

export type Conversation = {
  conversation_id: string;
  title: string;
  status: "active" | "archived";
  message_count: number;
  last_message_at: string;
};

export type SourceSnapshot = {
  sourceId: string;
  chunkId: string;
  authorityTitleOfficial?: string;
  authorityType?: string;
  authorityStatus?: string;
  articleNumber?: string;
  excerpt: string;
  officialSourceUrl?: string;
};

export type ChatMessage = {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  status: "pending" | "completed" | "failed" | "cancelled";
  sequence: number;
  content: string;
  source_snapshot?: SourceSnapshot[];
  idempotency_key?: string;
  created_at: string;
  optimistic?: boolean;
};

