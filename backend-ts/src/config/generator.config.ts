import dotenv from 'dotenv';
import { EgyptianEmploymentContractGenerator } from '../modules/contract-generation/contract-generation.service';

dotenv.config();

export const generator = new EgyptianEmploymentContractGenerator({
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.BASE_URL,
  qdrantUrl: process.env.QDRANT_URL || '',
  qdrantApiKey: process.env.QDRANT_API_KEY,
});
