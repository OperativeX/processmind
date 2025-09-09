#!/usr/bin/env node

/**
 * Creates a test user and generates an auth token for pipeline testing
 */

const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'http://localhost:5000';

async function createTestAuth() {
  try {
    // Generate random email to avoid conflicts
    const randomId = crypto.randomBytes(4).toString('hex');
    const testEmail = `test-${randomId}@pipeline-test.com`;
    const testPassword = 'TestPassword123!';
    
    console.log('Creating test user...');
    console.log('Email:', testEmail);
    
    // Try to register new user
    try {
      const registerResponse = await axios.post(`${API_URL}/api/v1/auth/register`, {
        email: testEmail,
        password: testPassword,
        firstName: 'Pipeline',
        lastName: 'Test',
        tenantName: 'test-tenant'
      });
      
      console.log('✅ User registered successfully');
    } catch (err) {
      if (err.response?.data?.message?.includes('already exists')) {
        console.log('User already exists, proceeding to login...');
      } else {
        throw err;
      }
    }
    
    // Wait a bit before login (in case of async processing)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Login to get token
    console.log('\nLogging in...');
    const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    
    const { token, user, tenant } = loginResponse.data.data;
    
    console.log('\n✅ Login successful!');
    console.log('\nAuth Token:', token);
    console.log('\nUser ID:', user.id);
    console.log('Tenant ID:', tenant.id);
    
    // Update .env.test file
    const fs = require('fs');
    const envPath = './.env.test';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update AUTH_TOKEN
    envContent = envContent.replace(
      /AUTH_TOKEN=.*/,
      `AUTH_TOKEN=${token}`
    );
    
    // Update TENANT_ID
    envContent = envContent.replace(
      /TEST_TENANT_ID=.*/,
      `TEST_TENANT_ID=${tenant.id}`
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Updated .env.test with auth token and tenant ID');
    
    console.log('\n🚀 Ready to run pipeline test!');
    console.log('Run: source .env.test && node test-video-pipeline.js');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

createTestAuth();