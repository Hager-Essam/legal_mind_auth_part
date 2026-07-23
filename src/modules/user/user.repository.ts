import User, { IUser } from './user.model';

class UserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email }).select('+password');
  }

  async findByEmailWithoutPassword(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    return await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id: string): Promise<IUser | null> {
    return await User.findByIdAndDelete(id);
  }

  async findAll(filters: any = {}, options: any = {}) {
    const { page = 1, limit = 10, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    const users = await User.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filters);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateLastLogin(userId: any): Promise<IUser | null> {
    return await User.findByIdAndUpdate(
      userId,
      { lastLogin: new Date() },
      { new: true }
    );
  }

  async existsByEmail(email: string) {
    return await User.exists({ email });
  }

  async findByResetToken(hashedToken: string): Promise<IUser | null> {
    return await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');
  }

  async updatePassword(userId: string, newPassword: string): Promise<IUser | null> {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    return await user.save();
  }
}

export default new UserRepository();
