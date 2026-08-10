export const ACTIVITY_TYPES = [
  "analysis",
  "generation",
  "blog",
  "conversation",
  "message",
  "bookmark",
  "comment",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityRecord = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
};

export type DailyGroup = {
  date: string;
  label: string;
  records: ActivityRecord[];
};

export type DailyActivityResponse = {
  period: { start: string; end: string };
  daily: DailyGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};
