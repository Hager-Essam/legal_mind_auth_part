import { GeneratedContract, IGeneratedContract } from '../models/generated-contract.model';

export class GeneratedContractRepository {
  /**
   * Create a new generated contract
   */
  async create(contractData: Partial<IGeneratedContract>): Promise<IGeneratedContract> {
    const contract = new GeneratedContract(contractData);
    return await contract.save();
  }

  /**
   * Find generated contract by job ID
   */
  async findByJobId(jobId: string): Promise<IGeneratedContract | null> {
    return await GeneratedContract.findOne({ jobId }).exec();
  }

  /**
   * Find generated contract by MongoDB _id
   */
  async findById(id: string): Promise<IGeneratedContract | null> {
    return await GeneratedContract.findById(id).exec();
  }

  /**
   * Update generated contract
   */
  async update(jobId: string, updateData: Partial<IGeneratedContract>): Promise<IGeneratedContract | null> {
    return await GeneratedContract.findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { new: true }
    ).exec();
  }

  /**
   * Delete generated contract by job ID
   */
  async deleteByJobId(jobId: string): Promise<boolean> {
    const result = await GeneratedContract.deleteOne({ jobId }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Delete generated contract by MongoDB _id
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await GeneratedContract.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}

// Export singleton instance
export const generatedContractRepository = new GeneratedContractRepository();
export default generatedContractRepository;
