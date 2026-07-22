const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const errorHandler = require('./middlewares/error-handler.middleware');
const authRoutes = require('./modules/auth/auth.routes');
const blogRoutes = require('./modules/blog/blog.routes');
const bookmarkRoutes = require('./modules/bookmark/bookmark.routes');
const { specs, swaggerUi } = require('./config/swagger');

const app = express();

app.use(
  cors({
    origin: config.cors.allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'LegalMind API Docs',
}));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'LegalMind API',
    version: '1.0.0',
    docs: '/api-docs',
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/users', bookmarkRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

app.use(errorHandler);

module.exports = app;
