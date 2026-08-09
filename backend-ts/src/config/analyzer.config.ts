import dotenv from 'dotenv';
import { EgyptianEmploymentContractAnalyzer } from '../modules/contract-analysis/contract-analysis.service';

dotenv.config();

export const analyzer = new EgyptianEmploymentContractAnalyzer({
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.LEGALMIND_DASHSCOPE_API_KEYS || '',
  baseURL: process.env.BASE_URL || process.env.LEGALMIND_DASHSCOPE_BASE_URL,
  qdrantUrl: process.env.QDRANT_URL || '',
  qdrantApiKey: process.env.QDRANT_API_KEY,
});
