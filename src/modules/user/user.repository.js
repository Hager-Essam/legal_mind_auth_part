const User = require('./user.model');

class UserRepository {
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async findById(id) {
    return await User.findById(id);
  }

  async findByEmail(email) {
    return await User.findOne({ email }).select('+password');
  }

  async findByEmailWithoutPassword(email) {
    return await User.findOne({ email });
  }

  async update(id, updateData) {
    return await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await User.findByIdAndDelete(id);
  }

  async findAll(filters = {}, options = {}) {
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

  async updateLastLogin(userId) {
    return await User.findByIdAndUpdate(
      userId,
      { lastLogin: new Date() },
      { new: true }
    );
  }

  async existsByEmail(email) {
    return await User.exists({ email });
  }

  async findByResetToken(hashedToken) {
    return await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');
  }

  async updatePassword(userId, newPassword) {
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

module.exports = new UserRepository();
