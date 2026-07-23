import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import ResponseHelper from '../shared/helpers/response.helper';

const validate = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      ResponseHelper.unprocessableEntity(res, 'Validation error', errors);
      return;
    }

    next();
  };
};

export default validate;
