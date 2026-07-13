import { performance } from "node:perf_hooks";

import { env } from "../config/env";
import type { QueryRequest, QueryResponse } from "../schemas/query.schema";
import { buildArabicLegalContext } from "../utils/context-builder";
import { toLegalChunk } from "../utils/chunk-mapper";
import { evaluateGrounding } from "../utils/grounding-policy";
import { ClassifierService } from "./classifier.service";
import {
  parseLegalReference,
  type ParsedLegalReference,
} from "../utils/legal-ref-parser";
import { GenerationService } from "./generation.service";
import { LegalRefService } from "./legal-ref.service";
import { ProviderConfigService } from "./provider-config.service";
import { QueryRewriteService } from "./query-rewrite.service";
import { RerankerService } from "./reranker.service";
import { RetrievalService } from "./retrieval.service";

export class QueryService {
  constructor(
    private readonly providerConfigService: ProviderConfigService,
    private readonly classifierService: ClassifierService,
    private readonly legalRefService: LegalRefService,
    private readonly retrievalService: RetrievalService,
    private readonly rerankerService: RerankerService,
    private readonly generationService: GenerationService,
    private readonly queryRewriteService: QueryRewriteService,
  ) {}

  async runQuery(request: QueryRequest): Promise<QueryResponse> 
  {
    const startedAt = performance.now();
    const provider = this.providerConfigService.getSummary();
    const llmProviderUsed = provider.llmProvider ?? env.llmProvider;
    const { category, parsedReference } =
      this.classifierService.classify(request);

    // if (category === "agent") {
    //   return {
    //     answer: "",
    //     source_chunks: [],
    //     llm_provider_used: llmProviderUsed,
    //     category,
    //     latency_ms: Math.round(performance.now() - startedAt),
    //   };
    // }

    if (category === "chat") {
      return this.runChatQuery(request, startedAt, llmProviderUsed);
    }

    if (category === "law_ref") {
      return this.runLawRefQuery(
        request,
        startedAt,
        llmProviderUsed,
        parsedReference,
      );
    }

    return this.runArabicRagQuery(
      request,
      startedAt,
      llmProviderUsed,
      undefined,
      parsedReference,
    );
  }

  private async runChatQuery(
    request: QueryRequest,
    startedAt: number,
    llmProviderUsed: string,
  ): Promise<QueryResponse> {
    try {
      const answer = await this.generationService.generateChatAnswer(
        request.query,
      );
      return {
        answer,
        source_chunks: [],
        llm_provider_used: llmProviderUsed,
        category: "chat",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      console.error("[QueryService] Chat generation failed:", error);
      return {
        answer: "مرحباً! كيف يمكنني مساعدتك في استفساراتك القانونية؟",
        source_chunks: [],
        llm_provider_used: llmProviderUsed,
        category: "chat",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    }
  }

  private async runLawRefQuery(
    request: QueryRequest,
    startedAt: number,
    llmProviderUsed: string,
    parsedReference?: ParsedLegalReference,
  ): Promise<QueryResponse> {
    const reference = parsedReference ?? parseLegalReference(request.query);

    // ── Path 1: explicit article number → exact law article lookup ───────────
    if (reference.articleNumber && reference.lawName) {
      // Pass `reference` so findByArticle can use law_number/law_year as bonus
      // filters. If law_name is missing, findByArticle returns null and we fall
      // through to RAG (we never return a bare/ambiguous Article N).
      const document = await this.retrievalService.findByArticle(reference);

      if (document) {
        return {
          answer: this.legalRefService.buildExactMatchAnswer(document),
          source_chunks: [
            toLegalChunk(document),
            ...document._children.map((c) => toLegalChunk(c)),
          ],
          llm_provider_used: null, // exact DB lookup — no LLM called
          category: "law_ref",
          latency_ms: Math.round(performance.now() - startedAt),
        };
      }

      // Article not found — fall through to RAG with a prefix message
      return this.runArabicRagQuery(
        request,
        startedAt,
        llmProviderUsed,
        this.legalRefService.buildNoExactMatchAnswer(reference),
        reference,
      );
    }

    // ── Path 2: appeal number → exact court ruling lookup ────────────────────
    if (reference.appealNumber) {
      const document = await this.retrievalService.findByAppeal(
        reference.appealNumber,
        reference.judicialYear,
      );

      if (document) {
        return {
          answer: this.legalRefService.buildRulingAnswer(document),
          source_chunks: [
            toLegalChunk(document),
            ...document._children.map((c) => toLegalChunk(c)),
          ],
          llm_provider_used: null, // exact DB lookup — no LLM called
          category: "law_ref",
          latency_ms: Math.round(performance.now() - startedAt),
        };
      }

      // Ruling not found — fall through to RAG; appeal filters are passed directly
      return this.runArabicRagQuery(
        request,
        startedAt,
        llmProviderUsed,
        this.legalRefService.buildNoRulingMatchAnswer(reference),
        reference,
      );
    }

    // ── Path 3: law name / number / year only → RAG with filters ───────────
    if (reference.lawNumber || reference.lawYear || reference.lawName) {
      return this.runArabicRagQuery(
        request,
        startedAt,
        llmProviderUsed,
        undefined,
        reference,
      );
    }

    return {
      answer: this.legalRefService.buildMissingArticleNumberAnswer(),
      source_chunks: [],
      llm_provider_used: null, // static error message — no LLM called
      category: "law_ref",
      latency_ms: Math.round(performance.now() - startedAt),
    };
  }

  private async runArabicRagQuery(
    request: QueryRequest,
    startedAt: number,
    llmProviderUsed: string,
    answerPrefix?: string,
    parsedReference?: ParsedLegalReference,
  ): Promise<QueryResponse> {
    const reference = parsedReference ?? parseLegalReference(request.query);

    // Build prompt hints for specific paragraph / clause references
    let promptInstruction = "";
    if (reference.paragraphs.length > 0) {
      promptInstruction += `\n- ركز على استخراج الإجابة من الفقرة رقم ${reference.paragraphs.join(" و ")} إن وجدت.`;
    }
    if (reference.clauses.length > 0) {
      promptInstruction += `\n- ركز على استخراج الإجابة من البند رقم ${reference.clauses.join(" و ")} إن وجدت.`;
    }

    const rewrite = await this.queryRewriteService.rewrite(
      request.query,
      request.user_role,
    );

    const rewriteRequest: QueryRequest = {
      ...request,
      query: rewrite.rewrittenQuery,
    };

    const candidateChunks = await this.retrievalService.retrieveCandidateChunks(
      rewriteRequest,
      reference,
    );

    const rerankTopK = Math.min(request.top_k, env.rerankTopK);

    const sourceChunks = await this.rerankerService.rerank(
      request.query,
      candidateChunks,
      rerankTopK,
    );

    if (sourceChunks.length === 0) {
      const answerParts = [
        answerPrefix,
        "لم يتم العثور على مواد قانونية ذات صلة كافية للإجابة عن السؤال في الوقت الحالي.",
      ].filter(Boolean);

      return {
        answer: answerParts.join(" "),
        source_chunks: [],
        llm_provider_used: llmProviderUsed,
        category: "arabic_rag",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    }

    const groundingDecision = evaluateGrounding(sourceChunks);
    if (!groundingDecision.shouldGenerate) {
      const answerParts = [
        answerPrefix,
        groundingDecision.refusalAnswer,
      ].filter(Boolean);

      return {
        answer: answerParts.join(" "),
        source_chunks: sourceChunks,
        llm_provider_used: llmProviderUsed,
        category: "arabic_rag",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    }

    // Expand child chunks to full parent text for LLM context.
    // sourceChunks (precise child citations) are kept as-is for the API response;
    // expandedChunks carry the full parent text so the LLM receives complete context.
    const expandedChunks =
      await this.retrievalService.expandWithParentContext(sourceChunks);

    const context = buildArabicLegalContext(expandedChunks);

    const finalQuestion = promptInstruction
      ? `${request.query}\n\nتعليمات إضافية للاستخراج:${promptInstruction}`
      : request.query;

    const answer = await this.generationService.generateGroundedArabicAnswer({
      question: finalQuestion,
      context,
      evidenceCount: sourceChunks.length,
    });

    return {
      answer: answerPrefix ? `${answerPrefix}\n\n${answer}` : answer,
      source_chunks: sourceChunks,
      llm_provider_used: llmProviderUsed,
      category: "arabic_rag",
      latency_ms: Math.round(performance.now() - startedAt),
    };
  }
}
