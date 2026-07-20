const ResponseHelper = require('../shared/helpers/response.helper');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return ResponseHelper.unprocessableEntity(res, 'Validation error', errors);
    }

    next();
  };
};

module.exports = validate;
