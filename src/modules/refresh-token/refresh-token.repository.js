const RefreshToken = require('./refresh-token.model');

class RefreshTokenRepository {
  async create(tokenData) {
    const token = new RefreshToken(tokenData);
    return await token.save();
  }

  async findByToken(token) {
    return await RefreshToken.findOne({ token, isActive: true }).populate('user');
  }

  async revokeToken(token, ipAddress) {
    const refreshToken = await RefreshToken.findOne({ token });
    if (!refreshToken) return null;

    refreshToken.revokedAt = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.isActive = false;

    return await refreshToken.save();
  }

  async revokeAllUserTokens(userId, ipAddress) {
    return await RefreshToken.updateMany(
      { user: userId, isActive: true },
      {
        revokedAt: Date.now(),
        revokedByIp: ipAddress,
        isActive: false,
      }
    );
  }

  async deleteExpiredTokens() {
    return await RefreshToken.deleteMany({
      expiresAt: { $lt: Date.now() },
    });
  }

  async findActiveTokensByUser(userId) {
    return await RefreshToken.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: Date.now() },
    });
  }
}

module.exports = new RefreshTokenRepository();
