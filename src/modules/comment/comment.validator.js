const Joi = require('joi');

const commentValidators = {
  createComment: Joi.object({
    content: Joi.string().min(1).max(1000).required().messages({
      'string.empty': 'Comment content is required',
      'string.min': 'Comment must be at least 1 character',
      'string.max': 'Comment cannot exceed 1000 characters',
      'any.required': 'Comment content is required',
    }),
  }),

  updateComment: Joi.object({
    content: Joi.string().min(1).max(1000).required().messages({
      'string.empty': 'Comment content is required',
      'string.min': 'Comment must be at least 1 character',
      'string.max': 'Comment cannot exceed 1000 characters',
      'any.required': 'Comment content is required',
    }),
  }),
};

module.exports = commentValidators;
