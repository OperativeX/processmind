const axios = require('axios');

async function testProcessAPI() {
  try {
    // Erstelle einen gültigen JWT für j.tacke1@web.de
    const loginResponse = await axios.post('http://localhost:5000/api/v1/auth/login', {
      email: 'j.tacke1@web.de',
      password: 'jonathan123'
    });
    
    console.log('✅ Login erfolgreich');
    const { user, tenant, tokens } = loginResponse.data.data;
    
    console.log('User:', user.email);
    console.log('Tenant:', tenant.name);
    console.log('Tenant ID:', tenant.id);
    
    // Test Process API
    const processResponse = await axios.get(
      `http://localhost:5000/api/v1/tenants/${tenant.id}/processes`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        }
      }
    );
    
    console.log('\n🔍 Process API Response:');
    console.log('Success:', processResponse.data.success);
    console.log('Process Count:', processResponse.data.data.processes.length);
    
    if (processResponse.data.data.processes.length > 0) {
      console.log('\n📋 Prozesse:');
      processResponse.data.data.processes.forEach((proc, index) => {
        console.log(`   ${index + 1}. ${proc.title || 'KEIN TITEL'}`);
        console.log(`      Status: ${proc.status}`);
        console.log(`      Datei: ${proc.originalFilename}`);
        console.log(`      ID: ${proc._id}`);
        console.log(`      Erstellt: ${proc.createdAt}`);
        console.log('');
      });
      
      console.log('✅ Die API gibt die Prozesse korrekt zurück!');
      console.log('❓ Das Problem liegt im Frontend oder in der Darstellung.');
      
    } else {
      console.log('❌ Keine Prozesse in API-Antwort!');
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error.response?.data || error.message);
  }
}

testProcessAPI();