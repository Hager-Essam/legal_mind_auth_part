const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    // Step 1: Basic Information
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password by default
    },
    
    // Step 2: Professional Information
    officeName: {
      type: String,
      required: [true, 'Office or law firm name is required'],
      trim: true,
      maxlength: [200, 'Office name cannot exceed 200 characters'],
    },
    barAssociationNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    lawyerIdDocument: {
      type: String,
      required: [true, 'Lawyer ID document is required'],
      trim: true,
    },
    teamSize: {
      type: String,
      required: [true, 'Team size is required'],
      enum: ['solo', 'small', 'medium', 'large'],
    },
    
    // System fields
    role: {
      type: String,
      enum: ['user', 'lawyer', 'admin'],
      default: 'lawyer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    
    // Legacy fields (kept for backward compatibility)
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get full name
userSchema.methods.getFullName = function () {
  // Use fullName if available, otherwise fall back to firstName + lastName
  return this.fullName || `${this.firstName || ''} ${this.lastName || ''}`.trim();
};

// Virtual field to split fullName into firstName and lastName if needed
userSchema.virtual('displayName').get(function () {
  return this.getFullName();
});

// Pre-save hook to populate firstName and lastName from fullName
userSchema.pre('save', function (next) {
  // If fullName exists but firstName/lastName don't, split them
  if (this.fullName && !this.firstName && !this.lastName) {
    const nameParts = this.fullName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      this.firstName = nameParts[0];
      this.lastName = nameParts.slice(1).join(' ');
    } else {
      this.firstName = this.fullName;
      this.lastName = '';
    }
  }
  next();
});

// Method to create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
