import { ResultsAnalysis, IResultsAnalysis } from '../models/results-analysis.model';

export class ResultsAnalysisRepository {
  /**
   * Create a new results analysis
   */
  async create(analysisData: Partial<IResultsAnalysis>): Promise<IResultsAnalysis> {
    const analysis = new ResultsAnalysis(analysisData);
    return await analysis.save();
  }

  /**
   * Find analysis by job ID
   */
  async findByJobId(jobId: string): Promise<IResultsAnalysis | null> {
    return await ResultsAnalysis.findOne({ jobId }).exec();
  }

  /**
   * Find analysis by MongoDB _id
   */
  async findById(id: string): Promise<IResultsAnalysis | null> {
    return await ResultsAnalysis.findById(id).exec();
  }

  /**
   * Find all analyses with optional filters
   */
  async findAll(filters?: {
    classification?: IResultsAnalysis['overall']['classification'];
    minScore?: number;
    maxScore?: number;
    limit?: number;
    skip?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<IResultsAnalysis[]> {
    const query: any = {};

    if (filters?.classification) {
      query['overall.classification'] = filters.classification;
    }

    if (filters?.minScore !== undefined) {
      query['overall.overall_score'] = { ...query['overall.overall_score'], $gte: filters.minScore };
    }

    if (filters?.maxScore !== undefined) {
      query['overall.overall_score'] = { ...query['overall.overall_score'], $lte: filters.maxScore };
    }

    const sortOrder = filters?.sortOrder === 'asc' ? 1 : -1;
    const sortBy = filters?.sortBy || 'processedAt';

    return await ResultsAnalysis.find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(filters?.limit || 100)
      .skip(filters?.skip || 0)
      .exec();
  }

  /**
   * Update analysis
   */
  async update(jobId: string, updateData: Partial<IResultsAnalysis>): Promise<IResultsAnalysis | null> {
    return await ResultsAnalysis.findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { new: true }
    ).exec();
  }

  /**
   * Delete analysis by job ID
   */
  async deleteByJobId(jobId: string): Promise<boolean> {
    const result = await ResultsAnalysis.deleteOne({ jobId }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Delete analysis by MongoDB _id
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await ResultsAnalysis.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Count analyses with optional filters
   */
  async count(filters?: {
    classification?: IResultsAnalysis['overall']['classification'];
    minScore?: number;
    maxScore?: number;
  }): Promise<number> {
    const query: any = {};

    if (filters?.classification) {
      query['overall.classification'] = filters.classification;
    }

    if (filters?.minScore !== undefined) {
      query['overall.overall_score'] = { ...query['overall.overall_score'], $gte: filters.minScore };
    }

    if (filters?.maxScore !== undefined) {
      query['overall.overall_score'] = { ...query['overall.overall_score'], $lte: filters.maxScore };
    }

    return await ResultsAnalysis.countDocuments(query).exec();
  }

  /**
   * Get analyses by classification
   */
  async findByClassification(
    classification: IResultsAnalysis['overall']['classification'],
    limit: number = 50
  ): Promise<IResultsAnalysis[]> {
    return await ResultsAnalysis.find({ 'overall.classification': classification })
      .sort({ processedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get high-risk analyses (critical or high_risk)
   */
  async findHighRisk(limit: number = 50): Promise<IResultsAnalysis[]> {
    return await ResultsAnalysis.find({
      'overall.classification': { $in: ['critical', 'high_risk'] },
    })
      .sort({ processedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get analyses with score above threshold
   */
  async findWithScoreAbove(minScore: number, limit: number = 50): Promise<IResultsAnalysis[]> {
    return await ResultsAnalysis.find({
      'overall.overall_score': { $gte: minScore },
    })
      .sort({ 'overall.overall_score': -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get analyses with score below threshold
   */
  async findWithScoreBelow(maxScore: number, limit: number = 50): Promise<IResultsAnalysis[]> {
    return await ResultsAnalysis.find({
      'overall.overall_score': { $lte: maxScore },
    })
      .sort({ 'overall.overall_score': 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get analyses within a date range
   */
  async findInDateRange(startDate: Date, endDate: Date): Promise<IResultsAnalysis[]> {
    return await ResultsAnalysis.find({
      processedAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ processedAt: -1 })
      .exec();
  }

  /**
   * Get statistics summary
   */
  async getStatistics(): Promise<{
    total: number;
    byClassification: Record<string, number>;
    averageScore: number;
    highRiskCount: number;
  }> {
    const all = await ResultsAnalysis.find().select('overall').exec();

    const byClassification: Record<string, number> = {
      excellent: 0,
      good: 0,
      needs_review: 0,
      high_risk: 0,
      critical: 0,
    };

    let totalScore = 0;
    let highRiskCount = 0;

    for (const analysis of all) {
      const classification = analysis.overall.classification;
      byClassification[classification] = (byClassification[classification] || 0) + 1;
      totalScore += analysis.overall.overall_score;

      if (classification === 'critical' || classification === 'high_risk') {
        highRiskCount++;
      }
    }

    return {
      total: all.length,
      byClassification,
      averageScore: all.length > 0 ? totalScore / all.length : 0,
      highRiskCount,
    };
  }

  /**
   * Get report markdown by job ID
   */
  async getReportMarkdown(jobId: string): Promise<string | null> {
    const analysis = await ResultsAnalysis.findOne({ jobId })
      .select('reportMarkdown')
      .exec();
    return analysis?.reportMarkdown || null;
  }

  /**
   * Get overall score by job ID
   */
  async getOverallScore(jobId: string): Promise<IResultsAnalysis['overall'] | null> {
    const analysis = await ResultsAnalysis.findOne({ jobId })
      .select('overall')
      .exec();
    return analysis?.overall || null;
  }

  /**
   * Get clauses by job ID
   */
  async getClauses(jobId: string): Promise<IResultsAnalysis['clauses'] | null> {
    const analysis = await ResultsAnalysis.findOne({ jobId })
      .select('clauses')
      .exec();
    return analysis?.clauses || null;
  }

  /**
   * Check if analysis exists for job
   */
  async existsForJob(jobId: string): Promise<boolean> {
    const count = await ResultsAnalysis.countDocuments({ jobId }).exec();
    return count > 0;
  }

  /**
   * Get latest analyses
   */
  async getLatest(limit: number = 10): Promise<IResultsAnalysis[]> {
    return await ResultsAnalysis.find()
      .sort({ processedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Delete analyses older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await ResultsAnalysis.deleteMany({ processedAt: { $lt: date } }).exec();
    return result.deletedCount;
  }

  /**
   * Get compliance statistics
   */
  async getComplianceStats(): Promise<{
    totalAnalyses: number;
    averageComplianceScore: number;
    averageRiskScore: number;
    averageCompletenessScore: number;
    averageBalanceScore: number;
  }> {
    const analyses = await ResultsAnalysis.find()
      .select('overall.breakdown')
      .exec();

    if (analyses.length === 0) {
      return {
        totalAnalyses: 0,
        averageComplianceScore: 0,
        averageRiskScore: 0,
        averageCompletenessScore: 0,
        averageBalanceScore: 0,
      };
    }

    let totalCompliance = 0;
    let totalRisk = 0;
    let totalCompleteness = 0;
    let totalBalance = 0;

    for (const analysis of analyses) {
      totalCompliance += analysis.overall.breakdown.compliance;
      totalRisk += analysis.overall.breakdown.risk;
      totalCompleteness += analysis.overall.breakdown.completeness;
      totalBalance += analysis.overall.breakdown.balance;
    }

    const count = analyses.length;

    return {
      totalAnalyses: count,
      averageComplianceScore: totalCompliance / count,
      averageRiskScore: totalRisk / count,
      averageCompletenessScore: totalCompleteness / count,
      averageBalanceScore: totalBalance / count,
    };
  }
}

// Export singleton instance
export const resultsAnalysisRepository = new ResultsAnalysisRepository();
export default resultsAnalysisRepository;
