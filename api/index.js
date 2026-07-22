const mongoose = require('mongoose');
const app = require('../src/app');

let cachedConnection = null;

const connectToDatabase = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached database connection');
    return cachedConnection;
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'legalmind';

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Establishing new database connection...');
    
    cachedConnection = await mongoose.connect(mongoUri, {
      dbName: dbName,
      bufferCommands: false,
      maxPoolSize: 10,
    });

    console.log('Database connected successfully');
    return cachedConnection;
  } catch (error) {
    console.error('Database connection error:', error);
    cachedConnection = null;
    throw error;
  }
};

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    });
  }
};
