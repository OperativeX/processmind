const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // Check specific users
    const emails = ['testadmin@processmind.com', 'lars.koetting@3d-composite.de'];
    
    console.log('\nChecking user details:\n');
    
    for (const email of emails) {
      const user = await db.collection('users').findOne({ email });
      
      if (user) {
        console.log(`Email: ${user.email}`);
        console.log(`User ID: ${user._id}`);
        console.log(`Tenant ID: ${user.tenantId}`);
        console.log(`Role: ${user.role || 'user'}`);
        console.log(`Created: ${user.createdAt}`);
        console.log(`Active: ${user.isActive !== false}`);
        
        // Get tenant info
        if (user.tenantId) {
          const tenant = await db.collection('tenants').findOne({ _id: user.tenantId });
          if (tenant) {
            console.log(`Tenant: ${tenant.name}`);
            console.log(`Tenant Domain: ${tenant.domain}`);
          }
        }
      } else {
        console.log(`User ${email} NOT FOUND`);
      }
      console.log('---\n');
    }
    
    // Also check if there are any users with similar emails
    console.log('Checking for similar emails:');
    const similarUsers = await db.collection('users').find({ 
      email: { $regex: /lars|koetting|testadmin|processmind/i } 
    }).toArray();
    
    similarUsers.forEach(user => {
      console.log(`- ${user.email} (Tenant ID: ${user.tenantId}, Role: ${user.role || 'user'})`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();