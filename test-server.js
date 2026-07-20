/**
 * Server Testing Script
 * Run this to diagnose server issues
 */

console.log('🧪 LegalMind Server Diagnostic Tool\n');

// Test 1: Check Node version
console.log('1️⃣ Checking Node.js version...');
console.log(`   Node version: ${process.version}`);
if (parseInt(process.version.slice(1)) < 14) {
  console.log('   ⚠️ Warning: Node.js 14+ recommended\n');
} else {
  console.log('   ✅ Node version OK\n');
}

// Test 2: Check environment variables
console.log('2️⃣ Checking environment variables...');
require('dotenv').config();
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
];

let envOk = true;
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`   ✅ ${varName} is set`);
  } else {
    console.log(`   ❌ ${varName} is missing`);
    envOk = false;
  }
});
console.log('');

// Test 3: Check MongoDB connection
console.log('3️⃣ Testing MongoDB connection...');
const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalmind';

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('   ✅ MongoDB connected successfully');
    console.log(`   📍 Connected to: ${mongoUri}\n`);
    
    // Test 4: Check if server can start
    console.log('4️⃣ Testing server startup...');
    const app = require('./src/app');
    const PORT = process.env.PORT || 5000;
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`   ✅ Server started on port ${PORT}\n`);
      
      // Test 5: Check routes
      console.log('5️⃣ Available routes:');
      console.log(`   📍 Health: http://localhost:${PORT}/health`);
      console.log(`   📍 Swagger: http://localhost:${PORT}/api-docs`);
      console.log(`   📍 Register: POST http://localhost:${PORT}/api/auth/register`);
      console.log(`   📍 Login: POST http://localhost:${PORT}/api/auth/login\n`);
      
      // Test 6: Test health endpoint
      console.log('6️⃣ Testing health endpoint...');
      const http = require('http');
      
      http.get(`http://localhost:${PORT}/health`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('   ✅ Health endpoint working');
            console.log(`   Response: ${data}\n`);
          } else {
            console.log(`   ❌ Health endpoint returned ${res.statusCode}\n`);
          }
          
          // Test 7: Get local IP
          console.log('7️⃣ Network information:');
          const os = require('os');
          const interfaces = os.networkInterfaces();
          console.log('   📱 Access from other devices:');
          
          Object.keys(interfaces).forEach(ifname => {
            interfaces[ifname].forEach(iface => {
              if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`   🌐 http://${iface.address}:${PORT}/api-docs`);
              }
            });
          });
          
          console.log('\n✨ Diagnostic complete!');
          console.log('📝 If you see errors above, fix them before running the server.\n');
          console.log('To start the server normally, run: npm run dev\n');
          
          server.close();
          mongoose.connection.close();
          process.exit(0);
        });
      }).on('error', (err) => {
        console.log(`   ❌ Could not reach health endpoint: ${err.message}\n`);
        server.close();
        mongoose.connection.close();
        process.exit(1);
      });
    });
    
  })
  .catch(err => {
    console.log(`   ❌ MongoDB connection failed: ${err.message}`);
    console.log(`   💡 Make sure MongoDB is running: mongod\n`);
    process.exit(1);
  });
