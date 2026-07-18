import { EmbeddingService } from "./embedding.service";
import { GenerationService } from "./generation.service";
import { ClassifierService } from "./classifier.service";
import { LegalRefService } from "./legal-ref.service";
import { QueryService } from "./query.service";
import { QueryRewriteService } from "./query-rewrite.service";
import { MongoService } from "./mongo.service";
import { ProviderConfigService } from "./provider-config.service";
import { RerankerService } from "./reranker.service";
import { RetrievalService } from "./retrieval.service";

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
  const queryRewriteService = new QueryRewriteService(providerConfigService);
  const queryService = new QueryService(
    providerConfigService,
    classifierService,
    legalRefService,
    retrievalService,
    rerankerService,
    generationService,
    queryRewriteService,
  );

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
  };
};
