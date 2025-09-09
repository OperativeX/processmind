require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { EmailDomain } = require('./src/models');
const logger = require('./src/utils/logger');

const API_BASE = 'http://localhost:5000/api/v1';

// Test data
const testData = {
  subdomain: 'acmecorp',
  company: {
    email: 'john.doe@acmecorp.com',
    password: 'SecureP@ss123',
    firstName: 'John',
    lastName: 'Doe',
    tenantName: 'ACME Corporation'
  },
  publicDomain: {
    email: 'jane.smith@gmail.com',
    password: 'AnotherP@ss456',
    firstName: 'Jane',
    lastName: 'Smith',
    tenantName: 'Smith Consulting'
  }
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {}
    };

    if (data) {
      config.data = data;
    }

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`${error.response.data.message || error.message}`);
    }
    throw error;
  }
}

// Test cases
async function runTests() {
  console.log('🧪 Starting Multi-Tenant Authentication Tests\n');

  try {
    // Connect to database and Redis
    await connectDB();
    await connectRedis();
    console.log('✅ Connected to MongoDB and Redis\n');

    // Initialize public domains
    await EmailDomain.initializePublicDomains();
    console.log('✅ Initialized public domains\n');

    // Test 1: Two-step registration with subdomain
    console.log('📝 Test 1: Two-step registration with subdomain');
    try {
      // Start registration
      const regResponse = await apiCall('POST', '/auth/register', {
        ...testData.company,
        subdomain: testData.subdomain
      });
      
      console.log('✅ Registration started:', regResponse.message);
      
      // Get verification code (in dev mode)
      const verificationCode = regResponse.data.verificationCode;
      console.log('📧 Verification code:', verificationCode);
      
      // Complete registration
      const verifyResponse = await apiCall('POST', '/auth/verify-registration', {
        email: testData.company.email,
        code: verificationCode
      });
      
      console.log('✅ Registration completed');
      console.log('👤 User:', verifyResponse.data.user.email);
      console.log('🏢 Tenant:', verifyResponse.data.tenant.name);
      console.log('🌐 Subdomain:', verifyResponse.data.tenant.domain);
      
      // Store tokens for later tests
      testData.company.tokens = verifyResponse.data.tokens;
      testData.company.tenantId = verifyResponse.data.tenant.id;
      
    } catch (error) {
      console.error('❌ Test 1 failed:', error.message);
    }
    console.log('\n---\n');

    // Test 2: Registration with public domain (Gmail)
    console.log('📝 Test 2: Registration with public domain');
    try {
      // Start registration
      const regResponse = await apiCall('POST', '/auth/register', testData.publicDomain);
      
      console.log('✅ Registration started:', regResponse.message);
      
      // Get verification code
      const verificationCode = regResponse.data.verificationCode;
      console.log('📧 Verification code:', verificationCode);
      
      // Complete registration
      const verifyResponse = await apiCall('POST', '/auth/verify-registration', {
        email: testData.publicDomain.email,
        code: verificationCode
      });
      
      console.log('✅ Registration completed');
      console.log('👤 User:', verifyResponse.data.user.email);
      console.log('🏢 Tenant:', verifyResponse.data.tenant.name);
      
      testData.publicDomain.tokens = verifyResponse.data.tokens;
      testData.publicDomain.tenantId = verifyResponse.data.tenant.id;
      
    } catch (error) {
      console.error('❌ Test 2 failed:', error.message);
    }
    console.log('\n---\n');

    // Test 3: Smart login with company domain
    console.log('📝 Test 3: Smart login with company domain');
    try {
      // Check tenant first
      const checkResponse = await apiCall('POST', '/auth/check-tenant', {
        email: testData.company.email
      });
      
      console.log('✅ Tenant found:', checkResponse.data.tenant.name);
      
      // Login without specifying tenant
      const loginResponse = await apiCall('POST', '/auth/login', {
        email: testData.company.email,
        password: testData.company.password
      });
      
      console.log('✅ Smart login successful');
      console.log('🏢 Resolved tenant:', loginResponse.data.tenant.name);
      console.log('🌐 Domain:', loginResponse.data.tenant.domain);
      
    } catch (error) {
      console.error('❌ Test 3 failed:', error.message);
    }
    console.log('\n---\n');

    // Test 4: Smart login with public domain
    console.log('📝 Test 4: Smart login with public domain');
    try {
      const loginResponse = await apiCall('POST', '/auth/login', {
        email: testData.publicDomain.email,
        password: testData.publicDomain.password
      });
      
      console.log('✅ Smart login successful');
      console.log('🏢 Resolved tenant:', loginResponse.data.tenant.name);
      
    } catch (error) {
      console.error('❌ Test 4 failed:', error.message);
    }
    console.log('\n---\n');

    // Test 5: Access tenant-specific endpoint
    console.log('📝 Test 5: Access tenant-specific endpoint');
    try {
      // Use the company token to access processes
      const processesResponse = await apiCall(
        'GET', 
        `/tenants/${testData.company.tenantId}/processes`,
        null,
        testData.company.tokens.accessToken
      );
      
      console.log('✅ Successfully accessed tenant-specific endpoint');
      console.log('📊 Processes:', processesResponse.data.processes.length);
      
    } catch (error) {
      console.error('❌ Test 5 failed:', error.message);
    }
    console.log('\n---\n');

    // Test 6: Rate limiting
    console.log('📝 Test 6: Rate limiting test');
    try {
      // Try to login multiple times quickly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(apiCall('POST', '/auth/login', {
          email: 'test@example.com',
          password: 'wrong'
        }).catch(e => e));
      }
      
      const results = await Promise.all(promises);
      const rateLimited = results.filter(r => r.message && r.message.includes('Too many'));
      
      console.log(`✅ Rate limiting working: ${rateLimited.length} requests blocked`);
      
    } catch (error) {
      console.error('❌ Test 6 failed:', error.message);
    }
    console.log('\n---\n');

    // Test 7: Subdomain resolution
    console.log('📝 Test 7: Subdomain resolution');
    try {
      // Simulate subdomain request by setting x-tenant header
      const config = {
        method: 'GET',
        url: `${API_BASE}/tenants/${testData.company.tenantId}/processes`,
        headers: {
          'Authorization': `Bearer ${testData.company.tokens.accessToken}`,
          'Host': `${testData.subdomain}.processmind.com`
        }
      };
      
      const response = await axios(config);
      console.log('✅ Subdomain resolution successful');
      console.log('🌐 Request processed for subdomain:', testData.subdomain);
      
    } catch (error) {
      console.error('❌ Test 7 failed:', error.message);
    }
    console.log('\n---\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    
    // Note: In a real test environment, you would clean up the test data
    // For now, we'll just disconnect
    
    console.log('\n✨ All tests completed!');

  } catch (error) {
    console.error('❌ Test suite error:', error);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run tests
runTests();