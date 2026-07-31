import Joi from 'joi';

const createBlogSchema = Joi.object({
  title: Joi.string().min(5).max(200).required().messages({
    'string.empty': 'العنوان مطلوب',
    'string.min': 'يجب أن يتكون العنوان من 5 أحرف على الأقل',
    'string.max': 'يجب ألا يتجاوز العنوان 200 حرف',
  }),
  content: Joi.string().min(20).required().messages({
    'string.empty': 'المحتوى مطلوب',
    'string.min': 'يجب أن يتكون المحتوى من 20 حرفًا على الأقل',
  }),
  coverImage: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'يجب أن تكون صورة الغلاف رابطًا صحيحًا',
  }),
  category: Joi.string()
    .valid(
      'Criminal Law',
      'Civil Law',
      'Corporate Law',
      'Family Law',
      'Labor Law',
      'Tax Law',
      'Other'
    )
    .required()
    .messages({
      'any.only': 'تصنيف غير صالح. يجب أن يكون أحد: القانون الجنائي، القانون المدني، القانون التجاري، قانون الأسرة، قانون العمل، القانون الضريبي، أخرى',
      'string.empty': 'التصنيف مطلوب',
    }),
  status: Joi.string().valid('draft', 'pending', 'published').optional().messages({
    'any.only': 'يجب أن تكون الحالة مسودة أو قيد المراجعة أو منشورة',
  }),
});

const updateBlogSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional().messages({
    'string.min': 'يجب أن يتكون العنوان من 5 أحرف على الأقل',
    'string.max': 'يجب ألا يتجاوز العنوان 200 حرف',
  }),
  content: Joi.string().min(20).optional().messages({
    'string.min': 'يجب أن يتكون المحتوى من 20 حرفًا على الأقل',
  }),
  coverImage: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'يجب أن تكون صورة الغلاف رابطًا صحيحًا',
  }),
  category: Joi.string()
    .valid(
      'Criminal Law',
      'Civil Law',
      'Corporate Law',
      'Family Law',
      'Labor Law',
      'Tax Law',
      'Other'
    )
    .optional()
    .messages({
      'any.only': 'تصنيف غير صالح',
    }),
  status: Joi.string().valid('draft', 'pending', 'published').optional().messages({
    'any.only': 'يجب أن تكون الحالة مسودة أو قيد المراجعة أو منشورة',
  }),
});

const updateBlogStatusSchema = Joi.object({
  status: Joi.string()
    .valid('draft', 'pending', 'published', 'rejected')
    .required()
    .messages({
      'any.only': 'يجب أن تكون الحالة مسودة أو قيد المراجعة أو منشورة أو مرفوضة',
      'string.empty': 'الحالة مطلوبة',
    }),
  rejectionReason: Joi.when('status', {
    is: 'rejected',
    then: Joi.string().required().messages({
      'string.empty': 'سبب الرفض مطلوب عند رفض المقال',
    }),
    otherwise: Joi.optional(),
  }),
});

export {
  createBlogSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
};
