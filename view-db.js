/**
 * Quick Database Viewer
 * Run: node view-db.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function viewDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get database
    const db = mongoose.connection.db;
    
    // Show database info
    console.log('📦 Database Name:', db.databaseName);
    console.log('🔗 Connection String:', process.env.MONGODB_URI);
    console.log('');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📂 Collections:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
    }
    console.log('');
    
    // Show users
    const users = await db.collection('users').find({}).toArray();
    console.log('👥 Users:');
    if (users.length === 0) {
      console.log('   No users yet. Register one first!');
    } else {
      users.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.fullName || user.firstName + ' ' + user.lastName}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Office: ${user.officeName || 'N/A'}`);
        console.log(`      Team Size: ${user.teamSize || 'N/A'}`);
        console.log(`      Created: ${user.createdAt}`);
        console.log('');
      });
    }
    
    // Show refresh tokens
    const tokens = await db.collection('refreshtokens').find({ isActive: true }).toArray();
    console.log(`🔑 Active Sessions: ${tokens.length}`);
    console.log('');
    
    await mongoose.connection.close();
    console.log('✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

viewDatabase();
