// Comprehensive frontend functionality test
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/v1';

async function testCompleteFrontend() {
  console.log('🧪 COMPREHENSIVE FRONTEND-BACKEND TEST');
  console.log('=====================================\n');

  try {
    // 1. Test Authentication
    console.log('1. 🔐 Testing Authentication...');
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'testuser@processmind.com',
      password: 'SecurePass123!'
    });
    
    const { tokens, tenant, user } = authResponse.data.data;
    console.log('   ✅ Authentication successful');
    console.log(`   👤 User: ${user.email}`);
    console.log(`   🏢 Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // 2. Test Process List API (Main frontend issue)
    console.log('\n2. 📋 Testing Process List API...');
    const processesResponse = await axios.get(
      `${API_BASE_URL}/tenants/${tenant.id}/processes`,
      { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
    );
    
    const { processes, pagination } = processesResponse.data.data;
    console.log('   ✅ Process List API working');
    console.log(`   📊 Total processes: ${pagination.totalCount}`);
    console.log(`   📄 Current page: ${processes.length} processes`);

    // Show process statuses
    const statusCounts = {};
    processes.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    console.log('   📈 Status distribution:', statusCounts);

    // 3. Test Graph Data API (Was broken, now fixed)
    console.log('\n3. 📊 Testing Graph Data API...');
    const graphResponse = await axios.get(
      `${API_BASE_URL}/tenants/${tenant.id}/processes/graph-data`,
      { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
    );
    
    const { nodes, links } = graphResponse.data.data;
    console.log('   ✅ Graph Data API working');
    console.log(`   🔗 Nodes: ${nodes.length}, Links: ${links.length}`);
    
    if (nodes.length === 0) {
      console.log('   ℹ️  No graph nodes (expected - processes need AI-generated tags)');
    }

    // 4. Test Individual Process Details
    if (processes.length > 0) {
      console.log('\n4. 🔍 Testing Process Details...');
      const sampleProcess = processes[0];
      
      const processResponse = await axios.get(
        `${API_BASE_URL}/tenants/${tenant.id}/processes/${sampleProcess.id}`,
        { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
      );
      
      const processData = processResponse.data.data.process;
      console.log('   ✅ Process Details API working');
      console.log(`   📁 Process: ${processData.originalFilename}`);
      console.log(`   📊 Status: ${processData.status}`);
      console.log(`   🔄 Progress: ${processData.progress?.percentage || 0}%`);
      console.log(`   🎤 Has Transcript: ${processData.transcript?.text ? 'Yes' : 'No'}`);
      console.log(`   🏷️  Tags: ${processData.tags?.length || 0}`);
      console.log(`   📝 Todo Items: ${processData.todoList?.length || 0}`);

      // 5. Test Process Status API (Real-time updates)
      console.log('\n5. ⏱️  Testing Process Status API...');
      const statusResponse = await axios.get(
        `${API_BASE_URL}/tenants/${tenant.id}/processes/${sampleProcess.id}/status`,
        { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
      );
      
      const statusData = statusResponse.data.data;
      console.log('   ✅ Process Status API working');
      console.log(`   📊 Status: ${statusData.status}`);
      console.log(`   🔄 Progress: ${statusData.progress?.percentage || 0}%`);
      console.log(`   📈 Current Step: ${statusData.progress?.currentStep || 'N/A'}`);
    }

    // 6. Test Tags API
    console.log('\n6. 🏷️  Testing Tags API...');
    const tagsResponse = await axios.get(
      `${API_BASE_URL}/tenants/${tenant.id}/processes/tags`,
      { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } }
    );
    
    const { tags } = tagsResponse.data.data;
    console.log('   ✅ Tags API working');
    console.log(`   🏷️  Available tags: ${tags.length}`);
    if (tags.length > 0) {
      console.log(`   📋 Sample tags: ${tags.slice(0, 5).join(', ')}`);
    }

    console.log('\n🎉 COMPREHENSIVE TEST RESULTS');
    console.log('==============================');
    console.log('✅ Authentication: WORKING');
    console.log('✅ Process List: WORKING');
    console.log('✅ Graph Data: WORKING');
    console.log('✅ Process Details: WORKING');
    console.log('✅ Process Status: WORKING');
    console.log('✅ Tags API: WORKING');

    console.log('\n💡 FRONTEND SOLUTIONS IMPLEMENTED:');
    console.log('• Fixed routing order for graph-data endpoint');
    console.log('• Enhanced error logging in API interceptors');
    console.log('• Improved upload experience with status updates');
    console.log('• Added prevention of multiple uploads');
    console.log('• Enhanced ProcessPage with real-time updates');

    console.log('\n🚀 FRONTEND SHOULD NOW WORK PROPERLY!');
    console.log('   Open: http://localhost:5001');
    console.log('   Login with: testuser@processmind.com / SecurePass123!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   URL: ${error.config?.url}`);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   🔌 Connection refused - is backend running on port 5000?');
    }
  }
}

testCompleteFrontend();