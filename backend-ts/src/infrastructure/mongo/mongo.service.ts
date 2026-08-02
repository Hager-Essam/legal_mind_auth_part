import mongoose, { type ConnectOptions, type Connection } from "mongoose";
import { env } from "../../config/env";

export const appConnection = mongoose.createConnection();
export const ragConnection = mongoose.createConnection();

export type MongoConnectionHealth = {
  connected: boolean;
  pingOk: boolean;
  database: string;
};

export type MongoHealth = {
  app: MongoConnectionHealth;
  rag: MongoConnectionHealth;
};

const connectionOptions = (dbName: string): ConnectOptions => ({
  dbName,
  serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  connectTimeoutMS: env.mongoConnectTimeoutMs,
  maxPoolSize: env.mongoMaxPoolSize,
  minPoolSize: env.mongoMinPoolSize,
});

const openConnection = async (connection: Connection, uri: string, dbName: string): Promise<void> => {
  if (connection.readyState === 1) return;

  if (connection.readyState === 2) {
    await connection.asPromise();
    return;
  }
  await connection.openUri(uri, connectionOptions(dbName));
};

const connectionHealth = async (connection: Connection, database: string): Promise<MongoConnectionHealth> => {
  if (connection.readyState !== 1 || !connection.db) {
    return { connected: false, pingOk: false, database };
  }

  try {
    await connection.db.command({ ping: 1 });

    return { connected: true, pingOk: true, database };
  } catch {
    return { connected: true, pingOk: false, database };
  }
};

export class MongoService {
  async connect(): Promise<void> {
    try {
      await Promise.all([
        openConnection(appConnection, env.appMongoUri, env.appMongoDb),
        openConnection(ragConnection, env.ragMongoUri, env.ragMongoDb),
      ]);
    } catch (error) {
      await this.close();

      throw error;
    }
  }

  async health(): Promise<MongoHealth> {
    const [app, rag] = await Promise.all([
      connectionHealth(appConnection, env.appMongoDb),
      connectionHealth(ragConnection, env.ragMongoDb),
    ]);

    return { app, rag };
  }

  async close(): Promise<void> {
    await Promise.all(
      [appConnection, ragConnection].map(async (connection) => {
        if (connection.readyState !== 0) await connection.close();
      })
    );
  }
}
