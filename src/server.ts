import app from './app';
import connectDB from './config/db';
import config from './config/env';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    const PORT = Number(config.port);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running in ${config.nodeEnv} mode on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 Swagger docs: http://localhost:${PORT}/api-docs`);
      console.log(`🌐 API endpoints: http://localhost:${PORT}/api`);
      console.log('');
      console.log('Available routes:');
      console.log('  POST /api/auth/register');
      console.log('  POST /api/auth/login');
      console.log('  POST /api/auth/forgot-password');
      console.log('  POST /api/auth/reset-password');
      console.log('  GET  /api/auth/me');
      console.log('  POST /api/analyze');
      console.log('  GET  /api/analyze/:jobId');
      console.log('  GET  /api/analyze/:jobId/progress');
      console.log('  GET  /api/analyze/:jobId/stream');
      console.log('  GET  /api/jobs');
      console.log('  DELETE /api/analyze/:jobId');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
