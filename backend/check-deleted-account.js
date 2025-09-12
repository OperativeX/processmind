const mongoose = require('mongoose');
require('dotenv').config();

async function checkDeletedAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('./src/models/User');
    const Process = require('./src/models/Process');
    const Tenant = require('./src/models/Tenant');
    
    // Check if user exists
    const user = await User.findOne({ email: 'free@3d-composite.de' });
    console.log('\n=== ACCOUNT CHECK FOR free@3d-composite.de ===');
    console.log('User found in database:', user ? 'YES ❌' : 'NO ✅');
    
    // Check for any tenant with this domain
    const tenant = await Tenant.findOne({ 
      $or: [
        { domain: '3d-composite' },
        { name: /3d.*composite/i },
        { 'users.email': 'free@3d-composite.de' }
      ]
    });
    console.log('Related tenant found:', tenant ? 'YES ❌' : 'NO ✅');
    
    if (tenant) {
      console.log('Tenant details:', {
        id: tenant._id,
        name: tenant.name,
        domain: tenant.domain
      });
    }
    
    // Check for any processes
    const processes = await Process.find({
      $or: [
        { 'metadata.userEmail': 'free@3d-composite.de' },
        { originalFilename: /3d.*composite/i }
      ]
    }).count();
    console.log('Related processes found:', processes > 0 ? `${processes} ❌` : '0 ✅');
    
    // Check all users for debugging
    const allUsers = await User.find({}).select('email role tenantId');
    console.log('\n=== ALL USERS IN DATABASE ===');
    allUsers.forEach(u => {
      console.log(`- ${u.email} (${u.role}) - Tenant: ${u.tenantId}`);
    });
    
    console.log('\n=== RESULT ===');
    if (!user && !tenant && processes === 0) {
      console.log('✅ Account and all data successfully deleted!');
    } else {
      console.log('❌ Some data still exists in the database');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkDeletedAccount();