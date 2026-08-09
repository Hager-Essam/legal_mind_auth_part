import dotenv from 'dotenv';
import { EgyptianEmploymentContractGenerator } from '../modules/contract-generation/contract-generation.service';

dotenv.config();

export const generator = new EgyptianEmploymentContractGenerator({
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.LEGALMIND_DASHSCOPE_API_KEYS || '',
  baseURL: process.env.BASE_URL || process.env.LEGALMIND_DASHSCOPE_BASE_URL,
  qdrantUrl: process.env.QDRANT_URL || '',
  qdrantApiKey: process.env.QDRANT_API_KEY,
});
