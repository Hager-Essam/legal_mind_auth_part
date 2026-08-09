import type { ActivityRecord, ActivityType, DailyGroup, DailyActivityResponse } from "./dashboard.types";
import type { DashboardRepository, RawActivityRow } from "./dashboard.repository";

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  analysis: "تم استكمال تحليل وتدقيق المستند",
  generation: "صياغة عقد ذكي مخصص",
  blog: "إضافة مقال جديد",
  conversation: "محادثة استشارية",
  message: "إرسال رسالة",
  bookmark: "إضافة إشارة مرجعية",
  comment: "إضافة تعليق",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  employment: "عمل",
  freelance: "عمل حر",
  partnership: "شراكة",
};

const LANGUAGE_LABELS: Record<string, string> = {
  ar: "العربية",
  ar_en: "العربية والإنجليزية",
};

const CATEGORY_LABELS: Record<string, string> = {
  "Criminal Law": "القانون الجنائي",
  "Civil Law": "القانون المدني",
  "Corporate Law": "القانون التجاري",
  "Family Law": "قانون الأسرة",
  "Labor Law": "قانون العمل",
  "Tax Law": "القانون الضريبي",
  Other: "أخرى",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  excellent: "ممتاز",
  good: "جيد",
  needs_review: "يحتاج مراجعة",
  high_risk: "مخاطر عالية",
  critical: "حرج",
};

function toArabicDigits(n: number): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n)
    .split("")
    .map((d) => arabicDigits[Number(d)] ?? d)
    .join("");
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays >= 2 && diffDays <= 6) return `منذ ${toArabicDigits(diffDays)} أيام`;

  const day = toArabicDigits(date.getDate());
  const month = toArabicDigits(date.getMonth() + 1);
  return `${day}/${month}`;
}

function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "مساءً" : "صباحاً";
  const h = hours % 12 || 12;
  const m = String(minutes).padStart(2, "0");
  return `${toArabicDigits(h)}:${m} ${period}`;
}

function formatAnalysis(row: RawActivityRow): ActivityRecord {
  const fileName = row.originalFileName ?? "مستند";
  const score = row.overallScore != null ? `${toArabicDigits(Math.round(row.overallScore))}٪` : null;
  const classification = row.classification ? CLASSIFICATION_LABELS[row.classification] ?? row.classification : null;
  const riskCount = row.topRisks?.length ?? 0;

  let description = `أعاد فحص ${fileName}`;

  if (score && classification) {
    description += ` نسبة مطابقة تبلغ ${score} - تصنيف ${classification}`;
  } else if (score) {
    description += ` بنسبة مطابقة تبلغ ${score}`;
  }

  if (riskCount > 0) {
    description += `. تم رصد ${toArabicDigits(riskCount)} مؤشرات لمخاطر صياغية`;
  }

  description += ".";

  return {
    id: row._id,
    type: "analysis",
    title: ACTIVITY_TYPE_LABELS.analysis,
    description,
    timestamp: row.timestamp,
    metadata: {
      fileName: row.originalFileName,
      score: row.overallScore,
      classification: row.classification,
      riskCount,
    },
  };
}

function formatGeneration(row: RawActivityRow): ActivityRecord {
  const contractLabel = row.contractType ? CONTRACT_TYPE_LABELS[row.contractType] ?? row.contractType : "عقد";
  const languageLabel = row.language ? LANGUAGE_LABELS[row.language] ?? row.language : "العربية";

  let description = `تمت صياغة عقد ${contractLabel} خاضع لولاية ومحاكم القاهرة`;
  description += `. تم تنسيق البنود وصياغتها باللغة ${languageLabel}.`;

  if (row.complianceScore != null) {
    const score = toArabicDigits(Math.round(row.complianceScore));
    const total = row.totalClauses != null ? toArabicDigits(row.totalClauses) : null;
    const compliant = row.compliantClauses != null ? toArabicDigits(row.compliantClauses) : null;
    if (total && compliant) {
      description += ` درجة الامتثال: ${score}٪ (${compliant}/${total} بند ممتثل).`;
    }
  }

  return {
    id: row._id,
    type: "generation",
    title: ACTIVITY_TYPE_LABELS.generation,
    description,
    timestamp: row.timestamp,
    metadata: {
      contractType: row.contractType,
      language: row.language,
      complianceScore: row.complianceScore,
    },
  };
}

function formatBlog(row: RawActivityRow): ActivityRecord {
  const title = row.title ?? "مقال";
  const categoryLabel = row.category ? CATEGORY_LABELS[row.category] ?? row.category : null;

  let description = `تم نشر مقال بعنوان "${title}"`;
  if (categoryLabel) {
    description += ` في تصنيف ${categoryLabel}`;
  }
  description += ".";

  return {
    id: row._id,
    type: "blog",
    title: ACTIVITY_TYPE_LABELS.blog,
    description,
    timestamp: row.timestamp,
    metadata: { title: row.title, category: row.category, status: row.status },
  };
}

function formatConversation(row: RawActivityRow): ActivityRecord {
  const title = row.title ?? "محادثة جديدة";
  const msgCount = row.messageCount ?? 0;

  let description = `تم إنشاء محادثة استشارية بعنوان "${title}"`;
  if (msgCount > 0) {
    description += ` تحتوي على ${toArabicDigits(msgCount)} رسالة`;
  }
  description += ".";

  return {
    id: row._id,
    type: "conversation",
    title: ACTIVITY_TYPE_LABELS.conversation,
    description,
    timestamp: row.timestamp,
    metadata: { title: row.title, messageCount: row.messageCount },
  };
}

function formatBookmark(row: RawActivityRow): ActivityRecord {
  const blogTitle = row.blogTitle ?? "مقال";

  return {
    id: row._id,
    type: "bookmark",
    title: ACTIVITY_TYPE_LABELS.bookmark,
    description: `تمت إضافة مقال "${blogTitle}" إلى المفضلة.`,
    timestamp: row.timestamp,
    metadata: { blogTitle: row.blogTitle, blogCategory: row.blogCategory },
  };
}

function formatComment(row: RawActivityRow): ActivityRecord {
  const blogTitle = row.blogTitle ?? "مقال";
  const contentPreview = row.content ? (row.content.length > 80 ? row.content.slice(0, 80) + "..." : row.content) : "";

  return {
    id: row._id,
    type: "comment",
    title: ACTIVITY_TYPE_LABELS.comment,
    description: `تمت إضافة تعليق على مقال "${blogTitle}": "${contentPreview}".`,
    timestamp: row.timestamp,
    metadata: { blogTitle: row.blogTitle, content: row.content },
  };
}

const FORMATTERS: Record<string, (row: RawActivityRow) => ActivityRecord> = {
  analysis: formatAnalysis,
  generation: formatGeneration,
  blog: formatBlog,
  conversation: formatConversation,
  bookmark: formatBookmark,
  comment: formatComment,
};

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getDailyActivity(
    userId: string,
    startDate: Date,
    endDate: Date,
    page: number,
    limit: number
  ): Promise<DailyActivityResponse> {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    const [analysisJobs, generationJobs, blogs, conversations, bookmarks, comments] =
      await Promise.all([
        this.repo.findAnalysisJobs(userId, start, end),
        this.repo.findGenerationJobs(userId, start, end),
        this.repo.findBlogs(userId, start, end),
        this.repo.findConversations(userId, start, end),
        this.repo.findBookmarks(userId, start, end),
        this.repo.findComments(userId, start, end),
      ]);

    const allRows = [
      ...analysisJobs,
      ...generationJobs,
      ...blogs,
      ...conversations,
      ...bookmarks,
      ...comments,
    ];

    const records: ActivityRecord[] = allRows
      .map((row) => {
        const formatter = FORMATTERS[row.type];
        return formatter ? formatter(row) : null;
      })
      .filter((r): r is ActivityRecord => r !== null);

    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const grouped = new Map<string, ActivityRecord[]>();
    for (const record of records) {
      const key = getDateKey(record.timestamp);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(record);
    }

    const allDaily: DailyGroup[] = [];
    const iterDate = new Date(start);
    while (iterDate <= end) {
      const key = getDateKey(iterDate);
      const dayRecords = grouped.get(key);
      if (dayRecords && dayRecords.length > 0) {
        allDaily.push({
          date: key,
          label: formatRelativeDate(iterDate),
          records: dayRecords,
        });
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }

    const total = allDaily.length;
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const daily = allDaily.slice(skip, skip + limit);

    return {
      period: {
        start: getDateKey(start),
        end: getDateKey(end),
      },
      daily,
      pagination: { page, limit, total, pages },
    };
  }
}
