import { env } from "../config/env";
import { normalizeArabicQuery } from "../utils/arabic-normalize";
import { rewriteWithMapping } from "../utils/law-mapping";
import { ProviderConfigService } from "./provider-config.service";
import type { RewriteResult } from "../types/query.types";

const LLM_REWRITE_TIMEOUT_MS = 8_000;

const REWRITE_SYSTEM_PROMPT = `انت مساعد لتحسين الاستعلامات القانونية في مصر.
مهمتك اعادة صياغة السؤال ليكون اكثر دقه ووضوحا للبحث في القوانين المصريه.

قواعد:
1. حول اللغه العاميه او غير الدقيقه الى مصطلحات قانونيه دقيقه
2. استخدم اسماء القوانين والمواد الصحيحه
3. لا تغير معنى السؤال الاصلي
4. اعد كتابه السؤال بالعربيه فقط
5. لا تضف ارقام مواد قانونيه الا اذا كنت متاكدا منها
6. اجعل السؤال مناسبا للبحث في قاعدة بيانات قانونيه`;

const isArabicClean = (text: string): boolean => {
  if (!text || !text.trim()) return false;
  return !/[a-zA-Z]/.test(text.replace(/[\s\d]/g, ""));
};

export class QueryRewriteService {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  private mappingOnly(query: string): RewriteResult 
  {
    const normalized = normalizeArabicQuery(query);
    const mappingResult = rewriteWithMapping(normalized);

    if (mappingResult.matched) {
      return { originalQuery: query, rewrittenQuery: mappingResult.rewritten, usedMapping: true, usedLlm: false, mappingMatch: mappingResult.matchedTerm };
    }

    return { originalQuery: query, rewrittenQuery: normalized, usedMapping: false, usedLlm: false, mappingMatch: null };
  }

  async rewrite(query: string, userRole?: "lawyer" | "citizen"): Promise<RewriteResult> 
  {
    const role = userRole ?? env.defaultUserRole;

    // Lawyers: mapping only (no LLM) — they already use legal terminology
    if (role === "lawyer") 
    {
      return this.mappingOnly(query);
    }

    // If query rewrite is disabled, just normalize and try mapping
    if (!env.enableQueryRewrite) 
    {
      return this.mappingOnly(query);
    }

    // Full rewrite for citizens: LLM + mapping
    try 
    {
      const llmResult = await this.rewriteWithLlm(query);
      if (!isArabicClean(llmResult)) return this.mappingOnly(query);

      const normalizedLlm = normalizeArabicQuery(llmResult);
      const mappingResult = rewriteWithMapping(normalizedLlm);

      if (mappingResult.matched && mappingResult.appendedLaw) {
        return { originalQuery: query, rewrittenQuery: `${llmResult} ${mappingResult.appendedLaw}`, usedMapping: true, usedLlm: true, mappingMatch: mappingResult.matchedTerm };
      }

      return { originalQuery: query, rewrittenQuery: llmResult, usedMapping: mappingResult.matched, usedLlm: true, mappingMatch: mappingResult.matchedTerm };
    } 
    catch (error) 
    {
      console.error("[QueryRewriteService] LLM rewrite failed, falling back to mapping-only:", error);
      return this.mappingOnly(query);
    }
  }

  private async rewriteWithLlm(query: string): Promise<string> {
    const apiKey = this.providerConfigService.getDashScopeApiKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_REWRITE_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.dashscopeCompatUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: env.llmRewriteModel,
          messages: [
            { role: "system", content: REWRITE_SYSTEM_PROMPT },
            { role: "user", content: query },
          ],
          temperature: 0.1,
          max_tokens: 256,
        }),
        signal: controller.signal,
      });

      const text = await response.text();
      console.log(`[QueryRewriteService] response ${response.status}: ${text.slice(0, 200)}`);

      if (!text || !text.trim()) {
        console.warn("[QueryRewriteService] Empty response from DashScope API, using original query");
        return query;
      }

      const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `LLM rewrite failed with status ${response.status}`);

      const content = payload.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim().length > 0) return content.trim();
      return query;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
