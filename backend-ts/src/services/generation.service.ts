import { ProviderConfigService } from "./provider-config.service";

type DashScopeChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> | null } }>;
  error?: { message?: string; code?: string };
  message?: string;
};

type GroundedArabicAnswerParams = {
  question: string;
  context: string;
  evidenceCount: number;
};

const CHAT_SYSTEM_PROMPT = `أنت مساعد قانوني مصري اسمه LegalMind. مهمتك مساعدة المستخدمين في الأسئلة القانونية المصرية.

قواعد الإجابة:
1. أجب بالعربية الفصحى الرسمية unless the user writes in English.
2. كن مختصراً وواضحاً في إجاباتك.
3. إذا كان السؤال قانونياً، اقترح على المستخدم توضيح سؤاله للحصول على إجابة دقيقة.
4. إذا كان السؤال شكر أو تحية، رد بلطف.
5. لا تخترع معلومات قانونية.
6. إذا لم تكن متأكداً من الإجابة، اقترح على المستخدم التحقق من مصدر قانوني موثوق.`;

const GENERATION_TIMEOUT_MS = 30_000; // 30 second timeout for LLM generation

export class GenerationService {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  async generateGroundedArabicAnswer(params: GroundedArabicAnswerParams): Promise<string> {
    const provider = this.providerConfigService.getSummary();
    try {
      return await this.generateChatCompletion(provider.llmModel, params);
    } catch (error) {
      if (provider.llmModelFallback === provider.llmModel) throw error;
      return this.generateChatCompletion(provider.llmModelFallback, params);
    }
  }

  async generateChatAnswer(question: string): Promise<string> {
    const provider = this.providerConfigService.getSummary();
    const apiKey = this.providerConfigService.getDashScopeApiKey();

    const url = `${provider.baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: provider.llmModelFallback,
          messages: [
            { role: "system", content: CHAT_SYSTEM_PROMPT },
            { role: "user", content: question },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      const text = await response.text();

      if (!text || !text.trim()) {
        throw new Error(`DashScope chat returned empty response (status ${response.status})`);
      }

      const payload = JSON.parse(text) as DashScopeChatCompletionResponse;
      if (!response.ok) throw new Error(this.buildErrorMessage(payload, response.status));

      return this.extractAnswerText(payload) || "مرحباً! كيف يمكنني مساعدتك؟";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async generateChatCompletion(model: string, params: GroundedArabicAnswerParams): Promise<string> {
    const apiKey = this.providerConfigService.getDashScopeApiKey();
    const provider = this.providerConfigService.getSummary();

    const url = `${provider.baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `أنت مستشار قانوني مصري متخصص تابع لمنصة LegalMind. مهمتك تقديم إجابات قانونية دقيقة ومُوثَّقة بالعربية الفصحى الرسمية.

القواعد الصارمة:
1. أجب حصرياً بناءً على النصوص القانونية المسترجعة في السياق. لا تستخدم معرفتك الخارجية إطلاقاً.
2. ابدأ إجابتك بالحكم القانوني الرئيسي في جملة واحدة واضحة.
3. ثم فسّر الأساس القانوني بالتفصيل مع ذكر النص الأصلي إذا أمكن.
4. أشر لكل نقطة قانونية بمصدرها: [المصدر: اسم القانون - المادة N]
5. إذا لم تجد إجابة كافية في السياق، قل: "لا تتوفر معلومات كافية في المصادر المتاحة للإجابة على هذا السؤال بدقة."
6. استخدم المصطلحات القانونية المصرية الصحيحة (مثلاً: "المادة" لا "البند"، "قانون" لا "نظام")
7. لا تلخص بشكل مفرط — أعطِ التفاصيل الكاملة مع النص الأصلي إذا أمكن.
8. رتب إجابتك على النحو التالي: (أ) الحكم القانوني الرئيسي، (ب) الأساس القانوني بالتفصيل، (ج) الاستثناءات أو الشروط إن وُجدت.
9. لا تخترع مواداً قانونية أو أرقام مواد غير موجودة في السياق المسترجع.
10. إذا كان السؤال يتطلب معلومة غير موجودة في السياق، اقترح على المستخدم التحقق من مصدر قانوني موثوق.`,
          },
          {
            role: "user",
            content: `أمثلة على الإجابات المطلوبة:

---مثال 1---
السؤال: ما هي جريمة النصب وعقوبتها؟

السياق المسترجع:
[المادة 336 من قانون العقوبات - جريمة النصب]
تنص المادة 336 من قانون العقوبات على أن "من حصل لنفسه أو لغيره على منفعة باستعمال طرق احتيالية أو مكاييل أو أوزان كاذبة أو بتزيين واقعة كاذبة، يُعاقب بالسجن من سنة إلى خمس سنوات وغرامة من مائة إلى ثلاثمائة جنيه".

الإجابة:
الحكم القانوني الرئيسي: جريمة النصب هي جريمة احتيالية يعاقب عليها القانون بالسجن والغرامة.

الأساس القانوني: وفقاً للمادة 336 من قانون العقوبات، تتحقق جريمة النصب عند توافر ثلاثة عناصر:
(أ) استعمال طرق احتيالية (كالكذب أو التزيين الكاذب)
(ب) الحصول على منفعة لنفسه أو لغيره
(ج) علاقة السببية بين الاحتيال والمنفعة المحصلة

العقوبة: السجن من سنة إلى خمس سنوات وغرامة من مائة إلى ثلاثمائة جنيه مصري.
[المصدر: قانون العقوبات - المادة 336]

---مثال 2---
السؤال: هل يحق للموظف فسخ عقد العمل إذا لم يحصل على راتبه؟

السياق المسترجع:
[المادة 109 من قانون العمل رقم 12 لسنة 2003]
"يحق للعامل فسخ عقد العمل في أي من الحالات التالية: (ب) إذا لم يُدفع له أجره في مواعيد الدفع المحددة في العقد أو في القانون".

[المادة 111 من قانون العمل]
"يجب على العامل قبل فسخ العقد أن يوجه إخطاراً كتابياً למעسوبه بفسخ العقد بعد مرور شهر من تاريخ الإخطار إذا لم يُدفع الأجر خلال هذه المدة".

الإجابة:
الحكم القانوني الرئيسي: نعم، يحق للموظف فسخ عقد العمل إذا لم يحصل على راتبه، لكن بشروط إجرائية محددة.

الأساس القانوني: يمنح القانون العامل حق فسخ العقد في حالة تأخر دفع الأجر وفقاً للمادة 109(ب) من قانون العمل. غير أن المادة 111 تشترط إجراءً إلزامياً: يجب على العامل أن يوجه إخطاراً كتابياً لمستخدمه بفسخ العقد، ويجب أن تمر شهر من تاريخ الإخطار دون دفع الأجر قبل أن يتحقق حق الفسخ.
[المصدر: قانون العمل - المادة 109]
[المصدر: قانون العمل - المادة 111]

---مثال 3---
السؤال: شركات ذات مسؤولية محدودة

السياق المسترجع:
[قانون الشركات رقم 159 لسنة 1981 - المادة 4]
"تنشأ شركة ذات مسؤولية محدودة من شخص واحد أو أكثر لا يتجاوز عددهم الخمسين، ولا تقل حصتهم عن ثلاثين ألف جنيه مصري".

[المادة 17 من قانون الشركات]
"تُسجل الشركة في السجل التجاري ويُنشر في الجريدة الرسمية."

الإجابة:
الحكم القانوني الرئيسي: شركة ذات المسؤولية المحدودة هي شركة أموال تنشأ من شخص واحد أو أكثر بحد أقصى خمسين شريكاً.

الأساس القانوني: وفقاً للمادة 4 من قانون الشركات رقم 159 لسنة 1981، تُنشأ شركة ذات المسؤولية المحدودة من شخص واحد أو أكثر لا يتجاوز عددهم الخمسين. يشترط أن لا تقل الحصة عن ثلاثين ألف جنيه مصري. كما تنص المادة 17 على وجب تسجيل الشركة في السجل التجاري ونشرها في الجريدة الرسمية لإتمام إجراءات التأسيس.
[المصدر: قانون الشركات - المادة 4]
[المصدر: قانون الشركات - المادة 17]

---

الآن أجب على السؤال التالي بنفس الأسلوب والتنسيق:

السياق القانوني المسترجع:\n${params.context}\n\nالسؤال: ${params.question}

ملاحظة: عدد المصادر المسترجعة: ${params.evidenceCount}. استخدمها جميعاً إذا كانت ذات صلة.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!text || !text.trim()) {
      throw new Error(`DashScope grounded returned empty response (status ${response.status})`);
    }

    const payload = JSON.parse(text) as DashScopeChatCompletionResponse;
    if (!response.ok) throw new Error(this.buildErrorMessage(payload, response.status));

    const answer = this.extractAnswerText(payload);
    if (!answer) throw new Error("DashScope chat completion returned an empty answer.");

    return answer;
  } finally {
    clearTimeout(timeoutId);
  }
}

  private extractAnswerText(payload: DashScopeChatCompletionResponse): string {
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) return content.map((item) => item.text ?? "").join("").trim();
    return "";
  }

  private buildErrorMessage(payload: DashScopeChatCompletionResponse, status: number): string {
    const msg = payload.error?.message ?? payload.message ?? "Unknown DashScope error.";
    const code = payload.error?.code ? ` (${payload.error.code})` : "";
    return `DashScope chat completion failed with status ${status}${code}: ${msg}`;
  }
}
