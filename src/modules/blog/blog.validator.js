const Joi = require('joi');

const createBlogSchema = Joi.object({
  title: Joi.string().min(5).max(200).required().messages({
    'string.empty': 'Title is required',
    'string.min': 'Title must be at least 5 characters',
    'string.max': 'Title cannot exceed 200 characters',
  }),
  content: Joi.string().min(20).required().messages({
    'string.empty': 'Content is required',
    'string.min': 'Content must be at least 20 characters',
  }),
  excerpt: Joi.string().max(500).optional().allow('').messages({
    'string.max': 'Excerpt cannot exceed 500 characters',
  }),
  coverImage: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Cover image must be a valid URL',
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
      'any.only': 'Invalid category. Must be one of: Criminal Law, Civil Law, Corporate Law, Family Law, Labor Law, Tax Law, Other',
      'string.empty': 'Category is required',
    }),
  tags: Joi.array().items(Joi.string().trim()).max(10).optional().messages({
    'array.max': 'Cannot have more than 10 tags',
  }),
  status: Joi.string().valid('draft', 'pending', 'published').optional().messages({
    'any.only': 'Status must be draft, pending, or published',
  }),
});

const updateBlogSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional().messages({
    'string.min': 'Title must be at least 5 characters',
    'string.max': 'Title cannot exceed 200 characters',
  }),
  content: Joi.string().min(20).optional().messages({
    'string.min': 'Content must be at least 20 characters',
  }),
  excerpt: Joi.string().max(500).optional().allow('').messages({
    'string.max': 'Excerpt cannot exceed 500 characters',
  }),
  coverImage: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Cover image must be a valid URL',
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
      'any.only': 'Invalid category',
    }),
  tags: Joi.array().items(Joi.string().trim()).max(10).optional().messages({
    'array.max': 'Cannot have more than 10 tags',
  }),
  status: Joi.string().valid('draft', 'pending', 'published').optional().messages({
    'any.only': 'Status must be draft, pending, or published',
  }),
});

const updateBlogStatusSchema = Joi.object({
  status: Joi.string()
    .valid('draft', 'pending', 'published', 'rejected')
    .required()
    .messages({
      'any.only': 'Status must be draft, pending, published, or rejected',
      'string.empty': 'Status is required',
    }),
  rejectionReason: Joi.when('status', {
    is: 'rejected',
    then: Joi.string().required().messages({
      'string.empty': 'Rejection reason is required when rejecting a blog',
    }),
    otherwise: Joi.optional(),
  }),
});

module.exports = {
  createBlogSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
};
