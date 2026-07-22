require('dotenv').config();
const mongoose = require('mongoose');

const testConnection = async () => {
  try {
    console.log('=== MongoDB Atlas Connection Test ===\n');
    
    const uri = process.env.MONGODB_URI;
    const maskedUri = uri.replace(/:[^:@]*@/, ':****@');
    console.log('Connection URI:', maskedUri);
    
    const uriParts = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)/);
    if (uriParts) {
      console.log('Username:', uriParts[1]);
      console.log('Password length:', uriParts[2].length, 'characters');
      console.log('Cluster:', uriParts[3]);
    }
    
    console.log('\nAttempting connection...');
    
    const conn = await mongoose.connect(uri, {
      dbName: 'legalmind',
      serverSelectionTimeoutMS: 5000,
    });

    console.log('\n✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('Host:', conn.connection.host);
    console.log('Database:', conn.connection.name);
    console.log('Connection state:', conn.connection.readyState);
    
    await mongoose.connection.close();
    console.log('\nConnection closed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR: Connection failed!');
    console.error('Error type:', error.name);
    console.error('Message:', error.message);
    
    if (error.message.includes('bad auth')) {
      console.error('\n⚠️  Authentication Failed - Possible causes:');
      console.error('   1. Incorrect username or password');
      console.error('   2. User not fully created yet (wait 1-2 minutes)');
      console.error('   3. User doesn\'t have proper database permissions');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.error('\n⚠️  Network Error - Possible causes:');
      console.error('   1. IP address not whitelisted in Atlas Network Access');
      console.error('   2. Firewall blocking connection');
      console.error('   3. Cluster is not accessible');
    }
    
    process.exit(1);
  }
};

testConnection();
