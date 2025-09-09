#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:5000';

async function loginTestUser() {
  try {
    // Try common test passwords
    const testPasswords = ['admin123', 'Admin123!', 'test123', 'Test123!', 'password', 'Password123!'];
    const email = 'testadmin@processmind.com';
    
    console.log('Trying to login as:', email);
    
    for (const password of testPasswords) {
      try {
        console.log(`Trying password: ${password.substring(0, 3)}***`);
        
        const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
          email: email,
          password: password
        });
        
        const { token, user, tenant } = loginResponse.data.data;
        
        console.log('\n✅ Login successful with password:', password);
        console.log('\nAuth Token:', token);
        console.log('User ID:', user.id);
        console.log('Tenant ID:', tenant.id);
        
        // Update .env.test file
        const envPath = './.env.test';
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        envContent = envContent.replace(/AUTH_TOKEN=.*/, `AUTH_TOKEN=${token}`);
        envContent = envContent.replace(/TEST_TENANT_ID=.*/, `TEST_TENANT_ID=${tenant.id}`);
        
        fs.writeFileSync(envPath, envContent);
        console.log('\n✅ Updated .env.test');
        console.log('\n🚀 Ready to run: source .env.test && node test-video-pipeline.js');
        
        return;
      } catch (err) {
        // Try next password
      }
    }
    
    console.log('\n❌ Could not login with any test password');
    console.log('Please check the actual password for testadmin@processmind.com');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

loginTestUser();