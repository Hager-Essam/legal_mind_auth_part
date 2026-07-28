import Joi from 'joi';

const updateProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Full name must be at least 2 characters',
    'string.max': 'Full name cannot exceed 100 characters',
  }),
  officeName: Joi.string().max(200).optional().messages({
    'string.max': 'Office name cannot exceed 200 characters',
  }),
  phone: Joi.string().optional().allow('').messages({
    'string.base': 'Phone must be a string',
  }),
  avatar: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Avatar must be a valid URL',
  }),
  teamSize: Joi.string().valid('solo', 'small', 'medium', 'large').optional().messages({
    'any.only': 'Team size must be one of: solo, small, medium, large',
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

export { updateProfileSchema };
