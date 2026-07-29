import { GenerationJob, IGenerationJob, IProgressLog } from '../models/generation-job.model';
import mongoose from 'mongoose';

export class GenerationJobRepository {
  /**
   * Create a new generation job
   */
  async create(jobData: Partial<IGenerationJob>): Promise<IGenerationJob> {
    const job = new GenerationJob(jobData);
    return await job.save();
  }

  /**
   * Find job by ID
   */
  async findById(jobId: string): Promise<IGenerationJob | null> {
    return await GenerationJob.findOne({ id: jobId }).exec();
  }

  /**
   * Find job by ID and userId (ownership check)
   */
  async findByIdAndUserId(jobId: string, userId: string): Promise<IGenerationJob | null> {
    return await GenerationJob.findOne({ id: jobId, userId }).exec();
  }

  /**
   * Find all jobs with optional filters
   */
  async findAll(filters?: {
    status?: IGenerationJob['status'];
    userId?: string;
    limit?: number;
    skip?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<IGenerationJob[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    const sortOrder = filters?.sortOrder === 'asc' ? 1 : -1;
    const sortBy = filters?.sortBy || 'createdAt';

    return await GenerationJob.find(query)
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
    status: IGenerationJob['status'],
    additionalData?: {
      error?: string;
      completedAt?: Date;
      generatedContractId?: mongoose.Types.ObjectId;
      contractFileUrl?: string;
    }
  ): Promise<IGenerationJob | null> {
    const updateData: any = { status };

    if (additionalData?.error) {
      updateData.error = additionalData.error;
    }

    if (additionalData?.completedAt) {
      updateData.completedAt = additionalData.completedAt;
    }

    if (additionalData?.generatedContractId) {
      updateData.generatedContractId = additionalData.generatedContractId;
    }

    if (additionalData?.contractFileUrl) {
      updateData.contractFileUrl = additionalData.contractFileUrl;
    }

    return await GenerationJob.findOneAndUpdate(
      { id: jobId },
      { $set: updateData },
      { new: true }
    ).exec();
  }

  /**
   * Add a progress log entry
   */
  async addProgressLog(jobId: string, log: IProgressLog): Promise<IGenerationJob | null> {
    return await GenerationJob.findOneAndUpdate(
      { id: jobId },
      { $push: { progressLogs: log } },
      { new: true }
    ).exec();
  }

  /**
   * Get progress logs for a job
   */
  async getProgressLogs(jobId: string): Promise<IProgressLog[]> {
    const job = await GenerationJob.findOne({ id: jobId }).select('progressLogs').exec();
    return job?.progressLogs || [];
  }

  /**
   * Delete a job
   */
  async delete(jobId: string): Promise<boolean> {
    const result = await GenerationJob.deleteOne({ id: jobId }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Count jobs with optional filters
   */
  async count(filters?: {
    status?: IGenerationJob['status'];
    userId?: string;
  }): Promise<number> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    return await GenerationJob.countDocuments(query).exec();
  }

  /**
   * Find jobs by user ID
   */
  async findByUserId(userId: string, limit: number = 50): Promise<IGenerationJob[]> {
    return await GenerationJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}

// Export singleton instance
export const generationJobRepository = new GenerationJobRepository();
export default generationJobRepository;
