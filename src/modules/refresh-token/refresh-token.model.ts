import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdByIp?: string;
  revokedAt?: Date;
  revokedByIp?: string;
  replacedByToken?: string;
  isActive: boolean;
  isExpired: boolean;
  isValid: boolean;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: Schema.Types.ObjectId,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to check if token is expired
refreshTokenSchema.virtual('isExpired').get(function (this: IRefreshToken) {
  return Date.now() >= this.expiresAt.getTime();
});

// Virtual to check if token is still valid
refreshTokenSchema.virtual('isValid').get(function (this: IRefreshToken) {
  return this.isActive && !this.isExpired;
});

const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
