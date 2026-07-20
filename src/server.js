const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config/env');

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    const PORT = config.port;
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
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
