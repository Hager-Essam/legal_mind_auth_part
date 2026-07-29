import userRepository from './user.repository';
import AppError from '../../shared/errors/app.error';
import HTTP_STATUS from '../../shared/constants/http-status';

class UserService {
  async updateProfile(userId: string, updateData: any) {
    const allowedFields = ['fullName', 'officeName', 'phone', 'avatar', 'teamSize'];
    const filtered: any = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filtered[field] = updateData[field];
      }
    }

    if (Object.keys(filtered).length === 0) {
      throw new AppError('No valid fields to update', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await userRepository.update(userId, filtered);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return user;
  }
}

export default new UserService();
