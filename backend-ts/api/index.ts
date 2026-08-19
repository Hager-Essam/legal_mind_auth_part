import { createApp } from "../src/app/create-app";
import { createServices } from "../src/services/service-container";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let appInstance: ReturnType<typeof createApp> | null = null;
let servicesInstance: ReturnType<typeof createServices> | null = null;

const getApp = async () => {
  if (!appInstance) {
    servicesInstance = createServices();
    await servicesInstance.mongoService.connect();
    appInstance = createApp(servicesInstance);
    console.log("[Vercel] App initialized");
  }
  return appInstance;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    // @ts-expect-error - Vercel req/res are compatible with Express
    return app(req, res);
  } catch (error) {
    console.error("[Vercel] Error handling request:", error);
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
