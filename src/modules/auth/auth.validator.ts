import Joi from 'joi';

const registerSchema = Joi.object({
  // Step 1: Basic Information
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Full name is required',
    'string.min': 'Full name must be at least 2 characters',
    'string.max': 'Full name cannot exceed 100 characters',
    'any.required': 'Full name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
  
  // Step 2: Professional Information
  officeName: Joi.string().max(200).required().messages({
    'string.empty': 'Office or law firm name is required',
    'string.max': 'Office name cannot exceed 200 characters',
    'any.required': 'Office or law firm name is required',
  }),
  barAssociationNumber: Joi.string().allow('', null).optional().messages({
    'string.base': 'Bar association number must be a valid string',
  }),
  teamSize: Joi.string()
    .valid('solo', 'small', 'medium', 'large')
    .required()
    .messages({
      'string.empty': 'Team size is required',
      'any.only': 'Team size must be one of: solo, small, medium, large',
      'any.required': 'Team size is required',
    }),
  
  // Optional fields
  phone: Joi.string().optional(),
  role: Joi.string().valid('user', 'lawyer').optional(),
  
  // Legacy support (will be ignored if fullName is provided)
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Reset token is required',
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
});

export {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
