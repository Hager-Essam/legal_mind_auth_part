import mongoose, { Schema, Document } from 'mongoose';

export interface IProgressLog {
  step: string;
  phase: 'start' | 'progress' | 'result' | 'done';
  message: string;
  timestamp: Date;
}

export interface IJob extends Document {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  userId?: string; // Optional: link to user who uploaded
  originalFileName: string;
  fileSize: number;
  fileType: string;
  contractFileUrl?: string; // R2 URL for the uploaded contract
  reportFileUrl?: string; // R2 URL for the generated report
  analysisId?: mongoose.Types.ObjectId; // Reference to ResultsAnalysis
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

const JobSchema = new Schema<IJob>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      required: true,
      default: 'queued',
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    contractFileUrl: {
      type: String,
    },
    reportFileUrl: {
      type: String,
    },
    analysisId: {
      type: Schema.Types.ObjectId,
      ref: 'ResultsAnalysis',
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
JobSchema.index({ createdAt: -1 });
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ userId: 1, createdAt: -1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
