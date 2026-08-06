import mongoose, { Schema, Document } from 'mongoose';
import { appConnection } from '../../../infrastructure/mongo/mongo.service';

export interface IProgressLog {
  step: string;
  phase: 'start' | 'progress' | 'result' | 'done';
  message: string;
  timestamp: Date;
}

export interface IGenerationJob extends Document {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  userId: string;
  prompt: string;
  language: 'ar' | 'ar_en';
  contractType: 'employment' | 'freelance' | 'partnership';
  generatedContractId?: mongoose.Types.ObjectId;
  contractFileUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  progressLogs: IProgressLog[];
}

const ProgressLogSchema = new Schema<IProgressLog>(
  {
    step: {
      type: String,
      required: true,
    },
    phase: {
      type: String,
      enum: ['start', 'progress', 'result', 'done'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const GenerationJobSchema = new Schema<IGenerationJob>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
      required: true,
      default: 'queued',
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      enum: ['ar', 'ar_en'],
      default: 'ar',
    },
    contractType: {
      type: String,
      enum: ['employment', 'freelance', 'partnership'],
      default: 'employment',
    },
    generatedContractId: {
      type: Schema.Types.ObjectId,
      ref: 'GeneratedContract',
    },
    contractFileUrl: {
      type: String,
    },
    error: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
    progressLogs: {
      type: [ProgressLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
GenerationJobSchema.index({ createdAt: -1 });
GenerationJobSchema.index({ status: 1, createdAt: -1 });
GenerationJobSchema.index({ userId: 1, createdAt: -1 });

export const GenerationJob = appConnection.model<IGenerationJob>('GenerationJob', GenerationJobSchema);
