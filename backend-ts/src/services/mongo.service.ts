import mongoose from "mongoose";

import { env } from "../config/env";

export class MongoService {
  // readyState: 0=disconnected 1=connected 2=connecting 3=disconnecting
  async connect(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  }

  async health(): Promise<{ connected: boolean; pingOk: boolean }> {
    try {
      await this.connect();
      const state = mongoose.connection.readyState;
      return { connected: true, pingOk: state === 1 };
    } catch {
      return { connected: false, pingOk: false };
    }
  }

  async close(): Promise<void> {
    await mongoose.disconnect();
  }
}
