import mongoose, { Schema, Document } from 'mongoose';

// Types matching contract-analysis.service.ts
interface LegalBasis {
  law: string;
  article: string;
  text: string;
  relevance: 'direct' | 'indirect';
}

interface RiskAssessment {
  level: number;
  category: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  potential_penalty?: string;
}

interface PartyBalance {
  favored_party: 'employer' | 'employee' | 'neutral';
  score: number;
  explanation: string;
}

interface RequiredAction {
  action_needed: boolean;
  severity: 'info' | 'warning' | 'critical';
  suggested_fix: string;
  rationale: string;
}

interface ClauseAnalysis {
  clause_id: string;
  clause_text: string;
  compliance: {
    status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'missing';
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
  };
  legal_basis: LegalBasis[];
  risk_assessment: RiskAssessment;
  party_balance: PartyBalance;
  required_action: RequiredAction;
  comparison_to_standard: {
    standard_clause: string;
    deviation: 'none' | 'minor' | 'major';
    deviation_details: string;
  };
}

interface OverallScore {
  overall_score: number;
  classification: 'excellent' | 'good' | 'needs_review' | 'high_risk' | 'critical';
  color: 'green' | 'yellow' | 'orange' | 'red';
  breakdown: {
    compliance: number;
    risk: number;
    completeness: number;
    balance: number;
  };
  mandatory_clauses: {
    present: number;
    missing: number;
    non_compliant: number;
  };
  summary: string;
  top_risks: string[];
  recommendations: string[];
}

export interface IResultsAnalysis extends Document {
  jobId: string; // Link back to Job
  overall: OverallScore;
  clauses: ClauseAnalysis[];
  reportMarkdown: string;
  processedAt: Date;
  metadata?: {
    totalClauses: number;
    processingTimeSeconds?: number;
    modelUsed?: string;
  };
}

const LegalBasisSchema = new Schema<LegalBasis>(
  {
    law: { type: String, required: true },
    article: { type: String, required: true },
    text: { type: String, required: true },
    relevance: {
      type: String,
      enum: ['direct', 'indirect'],
      required: true,
    },
  },
  { _id: false }
);

const RiskAssessmentSchema = new Schema<RiskAssessment>(
  {
    level: { type: Number, required: true },
    category: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    description: { type: String, required: true },
    potential_penalty: { type: String },
  },
  { _id: false }
);

const PartyBalanceSchema = new Schema<PartyBalance>(
  {
    favored_party: {
      type: String,
      enum: ['employer', 'employee', 'neutral'],
      required: true,
    },
    score: { type: Number, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const RequiredActionSchema = new Schema<RequiredAction>(
  {
    action_needed: { type: Boolean, required: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      required: true,
    },
    suggested_fix: { type: String, required: true, default: '' },
    rationale: { type: String, required: true },
  },
  { _id: false }
);

const ClauseAnalysisSchema = new Schema<ClauseAnalysis>(
  {
    clause_id: { type: String, required: true },
    clause_text: { type: String, required: true },
    compliance: {
      status: {
        type: String,
        enum: ['compliant', 'non_compliant', 'partially_compliant', 'missing'],
        required: true,
      },
      confidence: {
        type: String,
        enum: ['high', 'medium', 'low'],
        required: true,
      },
      explanation: { type: String, required: true },
    },
    legal_basis: {
      type: [LegalBasisSchema],
      default: [],
    },
    risk_assessment: {
      type: RiskAssessmentSchema,
      required: true,
    },
    party_balance: {
      type: PartyBalanceSchema,
      required: true,
    },
    required_action: {
      type: RequiredActionSchema,
      required: true,
    },
    comparison_to_standard: {
      standard_clause: { type: String, required: true },
      deviation: {
        type: String,
        enum: ['none', 'minor', 'major'],
        required: true,
      },
      deviation_details: { type: String, required: true },
    },
  },
  { _id: false }
);

const OverallScoreSchema = new Schema<OverallScore>(
  {
    overall_score: { type: Number, required: true },
    classification: {
      type: String,
      enum: ['excellent', 'good', 'needs_review', 'high_risk', 'critical'],
      required: true,
    },
    color: {
      type: String,
      enum: ['green', 'yellow', 'orange', 'red'],
      required: true,
    },
    breakdown: {
      compliance: { type: Number, required: true },
      risk: { type: Number, required: true },
      completeness: { type: Number, required: true },
      balance: { type: Number, required: true },
    },
    mandatory_clauses: {
      present: { type: Number, required: true },
      missing: { type: Number, required: true },
      non_compliant: { type: Number, required: true },
    },
    summary: { type: String, required: true },
    top_risks: {
      type: [String],
      default: [],
    },
    recommendations: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const ResultsAnalysisSchema = new Schema<IResultsAnalysis>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    overall: {
      type: OverallScoreSchema,
      required: true,
    },
    clauses: {
      type: [ClauseAnalysisSchema],
      default: [],
    },
    reportMarkdown: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      required: true,
    },
    metadata: {
      totalClauses: { type: Number },
      processingTimeSeconds: { type: Number },
      modelUsed: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ResultsAnalysisSchema.index({ processedAt: -1 });
ResultsAnalysisSchema.index({ 'overall.overall_score': 1 });
ResultsAnalysisSchema.index({ 'overall.classification': 1 });

export const ResultsAnalysis = mongoose.model<IResultsAnalysis>(
  'ResultsAnalysis',
  ResultsAnalysisSchema
);
