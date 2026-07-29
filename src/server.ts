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
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
