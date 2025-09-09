require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { User } = require('./src/models');

// Simuliere einen API-Test mit deinen aktuellen Credentials
const axios = require('axios');

async function checkCurrentSession() {
  try {
    // Versuche Login mit j.tacke1@web.de
    console.log('🔐 Testing login for j.tacke1@web.de...');
    
    const loginResponse = await axios.post('http://localhost:5000/api/v1/auth/login', {
      email: 'j.tacke1@web.de',
      password: 'jonathan123'
    });
    
    const { user, tenant, tokens } = loginResponse.data.data;
    
    console.log('\n✅ LOGIN SUCCESSFUL:');
    console.log('   User:', user.email);
    console.log('   User ID:', user.id);
    console.log('   Tenant:', tenant.name);
    console.log('   Tenant ID:', tenant.id);
    
    // Test process API with correct tenant
    console.log('\n🔍 Testing Process API...');
    const processResponse = await axios.get(
      `http://localhost:5000/api/v1/tenants/${tenant.id}/processes`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        }
      }
    );
    
    console.log('\n📊 PROCESSES FOR YOUR ACCOUNT:');
    console.log('   Total:', processResponse.data.data.processes.length);
    
    if (processResponse.data.data.processes.length > 0) {
      console.log('\n📋 Your Processes:');
      processResponse.data.data.processes.forEach((proc, i) => {
        console.log(`   ${i+1}. ${proc.title || 'Untitled'}`);
        console.log(`      Status: ${proc.status}`);
        console.log(`      File: ${proc.originalFilename}`);
        console.log(`      Created: ${new Date(proc.createdAt).toLocaleString()}`);
      });
    }
    
    console.log('\n💡 SOLUTION:');
    console.log('1. Clear your browser cache/localStorage completely');
    console.log('2. Login with: j.tacke1@web.de / jonathan123');
    console.log('3. You should see 3 processes in your dashboard');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkCurrentSession();