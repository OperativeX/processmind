const mongoose = require('mongoose');
require('dotenv').config();

async function checkTenants() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get tenants with processes
    const db = mongoose.connection.db;
    const tenants = await db.collection('tenants').find({}).toArray();
    const processes = await db.collection('processes').find({}).toArray();
    
    // Group processes by tenantId
    const processCountByTenant = {};
    processes.forEach(p => {
      const tid = p.tenantId?.toString();
      if (tid) {
        processCountByTenant[tid] = (processCountByTenant[tid] || 0) + 1;
      }
    });
    
    // Get users for each tenant
    const users = await db.collection('users').find({}).toArray();
    
    console.log('\nTenants with processes:\n');
    
    for (const tenant of tenants) {
      const tenantId = tenant._id.toString();
      const processCount = processCountByTenant[tenantId] || 0;
      
      if (processCount > 0) {
        console.log(`Tenant: ${tenant.name}`);
        console.log(`Domain: ${tenant.domain}`);
        console.log(`Process Count: ${processCount}`);
        console.log(`Active: ${tenant.isActive}`);
        
        // Get users for this tenant
        const tenantUsers = users.filter(u => u.tenantId?.toString() === tenantId);
        console.log(`\nUsers for this tenant:`);
        tenantUsers.forEach(user => {
          console.log(`  - Email: ${user.email}`);
          console.log(`    Role: ${user.role || 'user'}`);
        });
        console.log('---\n');
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTenants();