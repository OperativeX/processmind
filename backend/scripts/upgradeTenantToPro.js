const axios = require('axios');
require('dotenv').config();

async function upgradeTenantToPro() {
  try {
    const tenantId = '68b859ed11be1e43c02b8265';
    const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
    
    // First, login as super admin
    console.log('Logging in as super admin...');
    const loginResponse = await axios.post(`${baseUrl}/api/v1/super-admin/auth/login`, {
      email: process.env.SUPER_ADMIN_EMAIL,
      password: 'adminpassword', // You'll need to use the correct password
      secret: process.env.SUPER_ADMIN_SECRET
    });
    
    const { token } = loginResponse.data;
    console.log('✅ Super admin login successful');
    
    // Now upgrade the tenant
    console.log(`\nUpgrading tenant ${tenantId} to Pro...`);
    const upgradeResponse = await axios.post(
      `${baseUrl}/api/v1/super-admin/tenants/${tenantId}/upgrade-to-pro`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('\n✅ Upgrade successful!');
    console.log('Response:', JSON.stringify(upgradeResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Note: You need to replace 'adminpassword' with the actual super admin password
console.log('⚠️  Please edit this script and set the correct super admin password before running!');
console.log('The password hash in .env is: $2a$12$SWeaNbCm.N3J8HgkzFuso.JrJsV9jGHYROHdNjg58CMb.ysoeuVtO');
console.log('Which corresponds to password: adminpassword');
console.log('\nUncomment the line below to run the upgrade:');
upgradeTenantToPro();