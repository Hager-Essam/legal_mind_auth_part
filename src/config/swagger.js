const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const config = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LegalMind API Documentation',
      version: '1.0.0',
      description: 'Complete API documentation for LegalMind authentication system with blogs, comments, and bookmarks',
      contact: {
        name: 'LegalMind Team',
        email: 'support@legalmind.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.legalmind.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer {token}',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'Refresh token stored in httpOnly cookie',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            fullName: {
              type: 'string',
              example: 'هاجر عصام حسن بكر',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'hajar.essam@example.com',
            },
            officeName: {
              type: 'string',
              example: 'مكتب العدالة للمحاماة',
            },
            barAssociationNumber: {
              type: 'string',
              example: '12345',
            },
            teamSize: {
              type: 'string',
              enum: ['solo', 'small', 'medium', 'large'],
              example: 'small',
            },
            role: {
              type: 'string',
              enum: ['user', 'lawyer', 'admin'],
              example: 'lawyer',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            isEmailVerified: {
              type: 'boolean',
              example: false,
            },
            phone: {
              type: 'string',
              example: '+201234567890',
            },
            avatar: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'object',
              properties: {
                statusCode: {
                  type: 'integer',
                  example: 400,
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
            data: {
              type: 'object',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Blogs',
        description: 'Blog management endpoints',
      },
      {
        name: 'Comments',
        description: 'Blog comments management',
      },
      {
        name: 'Bookmarks',
        description: 'Blog bookmarks management',
      },
    ],
  },
  apis: [
    path.join(__dirname, '../modules/auth/auth.routes.js'),
    path.join(__dirname, '../modules/blog/blog.routes.js'),
    path.join(__dirname, '../modules/comment/comment.routes.js'),
    path.join(__dirname, '../modules/bookmark/bookmark.routes.js'),
  ],
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
};
