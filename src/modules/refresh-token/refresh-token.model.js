const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdByIp: {
      type: String,
    },
    revokedAt: {
      type: Date,
    },
    revokedByIp: {
      type: String,
    },
    replacedByToken: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to check if token is expired
refreshTokenSchema.virtual('isExpired').get(function () {
  return Date.now() >= this.expiresAt;
});

// Virtual to check if token is still valid
refreshTokenSchema.virtual('isValid').get(function () {
  return this.isActive && !this.isExpired;
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
