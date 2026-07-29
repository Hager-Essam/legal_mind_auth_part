import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IPlaceholder {
  field: string;
  label: string;
  required: boolean;
  filled: boolean;
}

export interface IComplianceWarning {
  clause: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface IComplianceCheck {
  compliant: boolean;
  warnings: IComplianceWarning[];
  autoFixesApplied: number;
}

export interface IValidationIssue {
  clause: string;
  status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'missing';
  explanation: string;
  suggestedFix?: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface IValidationResult {
  valid: boolean;
  score: number;
  issues: IValidationIssue[];
  compliantClauses: number;
  totalClauses: number;
}

export interface IGeneratedContract extends Document {
  jobId: string;
  contractSpec: Record<string, any>;
  contractMarkdown: string;
  editedMarkdown?: string;
  placeholders: IPlaceholder[];
  complianceCheck?: IComplianceCheck;
  validationResult?: IValidationResult;
  processedAt: Date;
  metadata?: {
    generationTimeSeconds?: number;
    modelUsed?: string;
    totalLlmCalls?: number;
  };
}

// ============================================================================
// SCHEMAS
// ============================================================================

const PlaceholderSchema = new Schema<IPlaceholder>(
  {
    field: { type: String, required: true },
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
    filled: { type: Boolean, default: false },
  },
  { _id: false }
);

const ComplianceWarningSchema = new Schema<IComplianceWarning>(
  {
    clause: { type: String, required: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      required: true,
    },
    message: { type: String, required: true },
  },
  { _id: false }
);

const ComplianceCheckSchema = new Schema<IComplianceCheck>(
  {
    compliant: { type: Boolean, required: true },
    warnings: { type: [ComplianceWarningSchema], default: [] },
    autoFixesApplied: { type: Number, default: 0 },
  },
  { _id: false }
);

const ValidationIssueSchema = new Schema<IValidationIssue>(
  {
    clause: { type: String, required: true },
    status: {
      type: String,
      enum: ['compliant', 'non_compliant', 'partially_compliant'],
      required: true,
    },
    explanation: { type: String, required: true },
    suggestedFix: { type: String },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      required: true,
    },
  },
  { _id: false }
);

const ValidationResultSchema = new Schema<IValidationResult>(
  {
    valid: { type: Boolean, required: true },
    score: { type: Number, required: true },
    issues: { type: [ValidationIssueSchema], default: [] },
    compliantClauses: { type: Number, required: true },
    totalClauses: { type: Number, required: true },
  },
  { _id: false }
);

const GeneratedContractSchema = new Schema<IGeneratedContract>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    contractSpec: {
      type: Schema.Types.Mixed,
      required: true,
    },
    contractMarkdown: {
      type: String,
      required: true,
    },
    editedMarkdown: {
      type: String,
    },
    placeholders: {
      type: [PlaceholderSchema],
      default: [],
    },
    complianceCheck: {
      type: ComplianceCheckSchema,
    },
    validationResult: {
      type: ValidationResultSchema,
    },
    processedAt: {
      type: Date,
      required: true,
    },
    metadata: {
      generationTimeSeconds: { type: Number },
      modelUsed: { type: String },
      totalLlmCalls: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
GeneratedContractSchema.index({ processedAt: -1 });
GeneratedContractSchema.index({ 'complianceCheck.compliant': 1 });

export const GeneratedContract = mongoose.model<IGeneratedContract>(
  'GeneratedContract',
  GeneratedContractSchema
);
