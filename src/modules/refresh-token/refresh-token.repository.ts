import RefreshToken, { IRefreshToken } from './refresh-token.model';

class RefreshTokenRepository {
  async create(tokenData: Partial<IRefreshToken>): Promise<IRefreshToken> {
    const token = new RefreshToken(tokenData);
    return await token.save();
  }

  async findByToken(token: string): Promise<IRefreshToken | null> {
    return await RefreshToken.findOne({ token, isActive: true }).populate('user');
  }

  async revokeToken(token: string, ipAddress?: string): Promise<IRefreshToken | null> {
    const refreshToken = await RefreshToken.findOne({ token });
    if (!refreshToken) return null;

    refreshToken.revokedAt = new Date();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.isActive = false;

    return await refreshToken.save();
  }

  async revokeAllUserTokens(userId: any, ipAddress?: string) {
    return await RefreshToken.updateMany(
      { user: userId, isActive: true },
      {
        revokedAt: new Date(),
        revokedByIp: ipAddress,
        isActive: false,
      }
    );
  }

  async deleteExpiredTokens() {
    return await RefreshToken.deleteMany({
      expiresAt: { $lt: new Date() },
    });
  }

  async findActiveTokensByUser(userId: any): Promise<IRefreshToken[]> {
    return await RefreshToken.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });
  }
}

export default new RefreshTokenRepository();
