import { createApp } from "./app/create-app";
import { env } from "./config/env";
import { createServices } from "./services/service-container";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const bootstrap = async () => {
  const services = createServices();
  await services.mongoService.connect();

  const app = createApp(services);
  const server = app.listen(env.apiPort, env.apiHost, () => {
    console.log(`[legalmind-backend-ts] listening on http://${env.apiHost}:${env.apiPort} (${env.nodeEnv})`);
    console.log(`[legalmind-backend-ts] boot summary ${JSON.stringify({
      app_name: env.appName, environment: env.nodeEnv,
      app_mongo_db: env.appMongoDb, rag_mongo_db: env.ragMongoDb,
      llm_model: env.llmModel, embedding_model: env.embeddingModel,
      hybrid_search: env.enableHybridSearch, query_rewrite: env.enableQueryRewrite,
      llm_rerank: env.enableLlmRerank, rerank_model: env.llmRerankModel,
    })}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[legalmind-backend-ts] received ${signal}, shutting down`);
    const forceExit = setTimeout(() => { console.error("[legalmind-backend-ts] shutdown timeout — forcing exit"); process.exit(1); }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();
    server.close(async () => { await services.mongoService.close(); process.exit(0); });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

void bootstrap();
