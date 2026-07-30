import { performance } from "node:perf_hooks";
import { env } from "../config/env";
import type { QueryRequest, QueryResponse } from "../schemas/query.schema";
import { buildArabicLegalContext } from "../utils/context-builder";
import { toLegalChunk } from "../utils/chunk-mapper";
import { evaluateGrounding } from "../utils/grounding-policy";
import {
  parseLegalReference,
  type ParsedLegalReference,
} from "../utils/legal-ref-parser";
import { validateSourceCitations } from "../utils/citation-validator";
import { ClassifierService } from "./classifier.service";
import { GenerationService } from "./generation.service";
import { LegalRefService } from "./legal-ref.service";
import { ProviderConfigService } from "./provider-config.service";
import { QueryRewriteService } from "./query-rewrite.service";
import { RerankerService } from "./reranker.service";
import { RetrievalService } from "./retrieval.service";

const mergeReferences = (
  original: ParsedLegalReference,
  retrieval: ParsedLegalReference,
): ParsedLegalReference => ({
  ...retrieval,
  articleNumber: original.articleNumber ?? retrieval.articleNumber,
  articleNumbers: [
    ...new Set([...original.articleNumbers, ...retrieval.articleNumbers]),
  ],
  paragraphs: [...new Set([...original.paragraphs, ...retrieval.paragraphs])],
  clauses: [...new Set([...original.clauses, ...retrieval.clauses])],
  lawName: original.lawName ?? retrieval.lawName,
  lawNumber: original.lawNumber ?? retrieval.lawNumber,
  lawYear: original.lawYear ?? retrieval.lawYear,
  appealNumber: original.appealNumber ?? retrieval.appealNumber,
  judicialYear: original.judicialYear ?? retrieval.judicialYear,
});

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

  async runQuery(request: QueryRequest): Promise<QueryResponse> {
    const startedAt = performance.now();
    const provider = this.providerConfigService.getSummary();
    const { category, parsedReference } =
      this.classifierService.classify(request);

    if (category === "chat") {
      const answer = await this.generationService.generateChatAnswer(
        request.query,
      );
      return {
        answer,
        source_chunks: [],
        llm_provider_used: provider.llmProvider,
        category: "chat",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    }
    if (category === "law_ref") {
      return this.runLawReference(
        request,
        startedAt,
        provider.llmProvider,
        parsedReference,
      );
    }
    return this.runRag(
      request,
      startedAt,
      provider.llmProvider,
      undefined,
      parsedReference,
    );
  }

  private async runLawReference(
    request: QueryRequest,
    startedAt: number,
    provider: string,
    parsedReference?: ParsedLegalReference,
  ): Promise<QueryResponse> {
    const reference = parsedReference ?? parseLegalReference(request.query);
    if (reference.articleNumbers.length > 0 && reference.lawName) {
      const found = [];
      const missing = [];
      for (const articleNumber of reference.articleNumbers) {
        const document = await this.retrievalService.findByArticle({
          ...reference,
          articleNumber,
          articleNumbers: [articleNumber],
        });
        if (document) found.push(document);
        else missing.push(articleNumber);
      }
      if (found.length > 0) {
        const answers = found.map((document) =>
          this.legalRefService.buildExactMatchAnswer(document),
        );
        if (missing.length > 0) {
          answers.push(
            `لم يتم العثور على نتيجة منشورة مؤهلة للمواد: ${missing.join("، ")}.`,
          );
        }
        return {
          answer: answers.join("\n\n"),
          source_chunks: found.flatMap((document) => [
            toLegalChunk(document),
            ...document._children.map((child) => toLegalChunk(child)),
          ]),
          llm_provider_used: null,
          category: "law_ref",
          latency_ms: Math.round(performance.now() - startedAt),
        };
      }
    }

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
            ...document._children.map((child) => toLegalChunk(child)),
          ],
          llm_provider_used: null,
          category: "law_ref",
          latency_ms: Math.round(performance.now() - startedAt),
        };
      }
    }

    return this.runRag(
      request,
      startedAt,
      provider,
      "لم يتم العثور على تطابق مباشر منشور؛ تم استخدام البحث الدلالي.",
      reference,
    );
  }

  private async runRag(
    request: QueryRequest,
    startedAt: number,
    provider: string,
    answerPrefix?: string,
    originalReference?: ParsedLegalReference,
  ): Promise<QueryResponse> {
    const original =
      originalReference ?? parseLegalReference(request.query);
    const rewrite = await this.queryRewriteService.rewrite(
      request.query,
      request.user_role,
    );
    const retrievalReference = parseLegalReference(rewrite.rewrittenQuery);
    const mergedReference = mergeReferences(original, retrievalReference);
    const rewrittenRequest: QueryRequest = {
      ...request,
      query: rewrite.rewrittenQuery,
    };
    const candidates = await this.retrievalService.retrieveCandidateChunks(
      rewrittenRequest,
      mergedReference,
    );
    const reranked = await this.rerankerService.rerank(
      request.query,
      candidates,
      Math.min(request.top_k, env.rerankTopK),
    );
    const grounding = evaluateGrounding(reranked);
    if (!grounding.shouldGenerate) {
      return {
        answer: [answerPrefix, grounding.refusalAnswer]
          .filter(Boolean)
          .join(" "),
        source_chunks: [],
        llm_provider_used: provider,
        category: "arabic_rag",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    }

    // Generation and the API response use the same qualified excerpts.
    const evidence = grounding.qualifiedChunks;
    const context = buildArabicLegalContext(evidence);
    const generated = await this.generationService.generateGroundedArabicAnswer(
      {
        question: request.query,
        context,
        evidenceCount: evidence.length,
      },
    );
    const answer = validateSourceCitations(generated, evidence.length);
    return {
      answer: answerPrefix ? `${answerPrefix}\n\n${answer}` : answer,
      source_chunks: evidence,
      llm_provider_used: provider,
      category: "arabic_rag",
      latency_ms: Math.round(performance.now() - startedAt),
      evidence_relevance_score: Math.max(
        ...evidence.map(
          (chunk) =>
            chunk.rerank_score ??
            chunk.similarity_score ??
            chunk.rrf_score ??
            0,
        ),
      ),
    };
  }
}
