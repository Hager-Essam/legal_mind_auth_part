import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import config from './config/env';
import errorHandler from './middlewares/error-handler.middleware';
import authRoutes from './modules/auth/auth.routes';
import blogRoutes from './modules/blog/blog.routes';
import bookmarkRoutes from './modules/bookmark/bookmark.routes';
import commentRoutes from './modules/comment/comment.routes';
import { specs, swaggerUi } from './config/swagger';

const app: Application = express();

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = config.cors.allowedOrigins;
      
      if (allowedOrigins.includes('*')) {
        callback(null, true);
      } else if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
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

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'LegalMind API',
    version: '1.0.0',
    docs: '/api-docs',
  });
});

app.get('/health', (_req: Request, res: Response) => {
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
app.use('/api', commentRoutes);

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

app.use(errorHandler);

export default app;
