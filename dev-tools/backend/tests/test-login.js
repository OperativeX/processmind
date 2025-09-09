const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:5000/api/v1/auth/login', {
      email: 'j.tacke1@web.de',
      password: 'jonathan123'
    });
    
    console.log('✅ Login erfolgreich!');
    console.log('Status:', response.status);
    console.log('User:', response.data.data.user.email);
    console.log('Tenant:', response.data.data.tenant.name);
    
  } catch (error) {
    console.error('❌ Login fehlgeschlagen:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
  }
}

testLogin();