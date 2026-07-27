import Joi from 'joi';

const registerSchema = Joi.object({
  // Step 1: Basic Information
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'الاسم الكامل مطلوب',
    'string.min': 'يجب ألا يقل الاسم الكامل عن حرفين',
    'string.max': 'يجب ألا يتجاوز الاسم الكامل 100 حرف',
    'any.required': 'الاسم الكامل مطلوب',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'يرجى إدخال بريد إلكتروني صالح',
    'any.required': 'البريد الإلكتروني مطلوب',
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.empty': 'كلمة المرور مطلوبة',
      'string.min': 'يجب ألا تقل كلمة المرور عن 8 أحرف',
      'string.pattern.base':
        'يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم واحد على الأقل',
      'any.required': 'كلمة المرور مطلوبة',
    }),

  // Step 2: Professional Information
  officeName: Joi.string().max(200).required().messages({
    'string.empty': 'اسم المكتب أو الشركة القانونية مطلوب',
    'string.max': 'يجب ألا يتجاوز اسم المكتب 200 حرف',
    'any.required': 'اسم المكتب أو الشركة القانونية مطلوب',
  }),
  barAssociationNumber: Joi.string().allow('', null).optional().messages({
    'string.base': 'رقم نقابة المحامين يجب أن يكون نصًا صالحًا',
  }),
  teamSize: Joi.string()
    .valid('solo', 'small', 'medium', 'large')
    .required()
    .messages({
      'string.empty': 'حجم الفريق مطلوب',
      'any.only': 'يجب أن يكون حجم الفريق أحد الخيارات التالية: فردي، صغير، متوسط، كبير',
      'any.required': 'حجم الفريق مطلوب',
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
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'يرجى إدخال بريد إلكتروني صالح',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'كلمة المرور مطلوبة',
  }),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'رمز التحديث مطلوب',
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'يرجى إدخال بريد إلكتروني صالح',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'رمز إعادة التعيين مطلوب',
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.empty': 'كلمة المرور مطلوبة',
      'string.min': 'يجب ألا تقل كلمة المرور عن 8 أحرف',
      'string.pattern.base':
        'يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم واحد على الأقل',
    }),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'رمز التفعيل مطلوب',
    'any.required': 'رمز التفعيل مطلوب',
  }),
});

const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'يرجى إدخال بريد إلكتروني صالح',
    'any.required': 'البريد الإلكتروني مطلوب',
  }),
});

export {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
};
