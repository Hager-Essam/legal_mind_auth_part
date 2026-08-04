import { Job, IJob, IProgressLog } from '../models/job.model';
import mongoose from 'mongoose';

export class JobRepository {
  /**
   * Create a new job
   */
  async create(jobData: Partial<IJob>): Promise<IJob> {
    const job = new Job(jobData);
    return await job.save();
  }

  /**
   * Find job by ID
   */
  async findById(jobId: string): Promise<IJob | null> {
    return await Job.findOne({ id: jobId }).exec();
  }

  /**
   * Find job by ID and userId (ownership check)
   */
  async findByIdAndUserId(jobId: string, userId: string): Promise<IJob | null> {
    return await Job.findOne({ id: jobId, userId }).exec();
  }

  /**
   * Find job by MongoDB _id
   */
  async findByMongoId(mongoId: string): Promise<IJob | null> {
    return await Job.findById(mongoId).exec();
  }

  /**
   * Find all jobs with optional filters
   */
  async findAll(filters?: {
    status?: IJob['status'];
    userId?: string;
    limit?: number;
    skip?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<IJob[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    const sortOrder = filters?.sortOrder === 'asc' ? 1 : -1;
    const sortBy = filters?.sortBy || 'createdAt';

    return await Job.find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(filters?.limit || 100)
      .skip(filters?.skip || 0)
      .exec();
  }

  /**
   * Update job status
   */
  async updateStatus(
    jobId: string,
    status: IJob['status'],
    additionalData?: {
      error?: string;
      completedAt?: Date;
      analysisId?: mongoose.Types.ObjectId;
      reportFileUrl?: string;
    }
  ): Promise<IJob | null> {
    const updateData: any = { status };

    if (additionalData?.error) {
      updateData.error = additionalData.error;
    }

    if (additionalData?.completedAt) {
      updateData.completedAt = additionalData.completedAt;
    }

    if (additionalData?.analysisId) {
      updateData.analysisId = additionalData.analysisId;
    }

    if (additionalData?.reportFileUrl) {
      updateData.reportFileUrl = additionalData.reportFileUrl;
    }

    return await Job.findOneAndUpdate(
      { id: jobId },
      { $set: updateData },
      { new: true }
    ).exec();
  }

  /**
   * Update job with contract file URL
   */
  async updateContractFileUrl(jobId: string, contractFileUrl: string): Promise<IJob | null> {
    return await Job.findOneAndUpdate(
      { id: jobId },
      { $set: { contractFileUrl } },
      { new: true }
    ).exec();
  }

  /**
   * Update job with report file URL
   */
  async updateReportFileUrl(jobId: string, reportFileUrl: string): Promise<IJob | null> {
    return await Job.findOneAndUpdate(
      { id: jobId },
      { $set: { reportFileUrl } },
      { new: true }
    ).exec();
  }

  /**
   * Update job with analysis ID
   */
  async updateAnalysisId(jobId: string, analysisId: mongoose.Types.ObjectId): Promise<IJob | null> {
    return await Job.findOneAndUpdate(
      { id: jobId },
      { $set: { analysisId } },
      { new: true }
    ).exec();
  }

  /**
   * Add a progress log entry
   */
  async addProgressLog(jobId: string, log: IProgressLog): Promise<IJob | null> {
    return await Job.findOneAndUpdate(
      { id: jobId },
      { $push: { progressLogs: log } },
      { new: true }
    ).exec();
  }

  /**
   * Add multiple progress log entries
   */
  async addProgressLogs(jobId: string, logs: IProgressLog[]): Promise<IJob | null> {
    return await Job.findOneAndUpdate(
      { id: jobId },
      { $push: { progressLogs: { $each: logs } } },
      { new: true }
    ).exec();
  }

  /**
   * Get progress logs for a job
   */
  async getProgressLogs(jobId: string): Promise<IProgressLog[]> {
    const job = await Job.findOne({ id: jobId }).select('progressLogs').exec();
    return job?.progressLogs || [];
  }

  /**
   * Delete a job
   */
  async delete(jobId: string): Promise<boolean> {
    const result = await Job.deleteOne({ id: jobId }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Count jobs with optional filters
   */
  async count(filters?: {
    status?: IJob['status'];
    userId?: string;
  }): Promise<number> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    return await Job.countDocuments(query).exec();
  }

  /**
   * Find jobs by user ID
   */
  async findByUserId(userId: string, limit: number = 50): Promise<IJob[]> {
    return await Job.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Find jobs by status
   */
  async findByStatus(status: IJob['status'], limit: number = 50): Promise<IJob[]> {
    return await Job.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Find completed jobs within a date range
   */
  async findCompletedInRange(startDate: Date, endDate: Date): Promise<IJob[]> {
    return await Job.find({
      status: 'completed',
      completedAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ completedAt: -1 })
      .exec();
  }

  /**
   * Update job (generic update)
   */
  async update(jobId: string, updateData: Partial<IJob>): Promise<IJob | null> {
    return await Job.findOneAndUpdate(
      { id: jobId },
      { $set: updateData },
      { new: true }
    ).exec();
  }

  /**
   * Check if job exists
   */
  async exists(jobId: string): Promise<boolean> {
    const count = await Job.countDocuments({ id: jobId }).exec();
    return count > 0;
  }

  /**
   * Get latest jobs
   */
  async getLatest(limit: number = 10): Promise<IJob[]> {
    return await Job.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Delete jobs older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await Job.deleteMany({ createdAt: { $lt: date } }).exec();
    return result.deletedCount;
  }
}

// Export singleton instance
export const jobRepository = new JobRepository();
export default jobRepository;
