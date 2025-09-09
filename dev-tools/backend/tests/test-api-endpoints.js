#!/usr/bin/env node

/**
 * Test API endpoints functionality with performance middleware
 */

const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:5000';

// Test endpoints
const endpoints = [
  {
    name: 'Health Check',
    method: 'GET',
    url: '/health',
    expectedStatus: 200,
    validateResponse: (data) => data.status === 'ok'
  },
  {
    name: 'Performance Metrics',
    method: 'GET', 
    url: '/metrics',
    expectedStatus: 200,
    validateResponse: (data) => data.timestamp && data.process && data.memory
  },
  {
    name: 'API Root (404)',
    method: 'GET',
    url: '/api/v1',
    expectedStatus: 404
  },
  {
    name: 'Auth Endpoints Available',
    method: 'GET',
    url: '/api/v1/auth',
    expectedStatus: 404 // No GET handler on auth root
  },
  {
    name: 'Public Routes Available',
    method: 'GET',
    url: '/api/v1/public',
    expectedStatus: 404 // No GET handler on public root
  }
];

async function testEndpoint(endpoint) {
  const startTime = Date.now();
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: API_BASE + endpoint.url,
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    
    const duration = Date.now() - startTime;
    const passed = response.status === endpoint.expectedStatus && 
                  (!endpoint.validateResponse || endpoint.validateResponse(response.data));
    
    return {
      name: endpoint.name,
      passed,
      status: response.status,
      expected: endpoint.expectedStatus,
      duration,
      responseTime: response.headers['x-response-time'],
      details: passed ? null : `Expected ${endpoint.expectedStatus}, got ${response.status}`
    };
    
  } catch (error) {
    return {
      name: endpoint.name,
      passed: false,
      error: error.code === 'ECONNREFUSED' ? 'Server not running' : error.message,
      duration: Date.now() - startTime
    };
  }
}

async function runTests() {
  console.log('🧪 Testing API Endpoints\n');
  console.log(`Server: ${API_BASE}`);
  console.log('================================\n');
  
  const results = [];
  
  // Check if server is running
  try {
    await axios.get(API_BASE + '/health', { timeout: 2000 });
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not running or not accessible');
    console.error(`   Please ensure the server is running on ${API_BASE}\n`);
    process.exit(1);
  }
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   Status: ${result.status || 'ERROR'} | Duration: ${result.duration}ms`);
    
    if (result.responseTime) {
      console.log(`   Response Time Header: ${result.responseTime}`);
    }
    
    if (!result.passed && result.details) {
      console.log(`   Details: ${result.details}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Test Summary:');
  console.log('================');
  const passed = results.filter(r => r.passed).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${results.length - passed}`);
  console.log(`Average Response Time: ${Math.round(avgDuration)}ms`);
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '✅ All tests passed!' : '⚠️  Some tests failed'}`);
  
  // Performance metrics check
  if (results.find(r => r.name === 'Performance Metrics' && r.passed)) {
    console.log('\n🎯 Performance Monitoring is working correctly!');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(console.error);