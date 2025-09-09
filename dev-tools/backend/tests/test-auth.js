const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function registerUser() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, {
      email: 'testuser@processmind.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
      tenantName: 'Process Mind Test Co'
    });

    console.log('Registration successful!');
    console.log('User ID:', response.data.data.user.id);
    console.log('Tenant ID:', response.data.data.tenant.id);
    console.log('Access Token:', response.data.data.tokens.accessToken);
    console.log('Refresh Token:', response.data.data.tokens.refreshToken);

    return response.data.data;
  } catch (error) {
    if (error.response) {
      console.log('Registration failed:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

async function loginUser() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'testuser@processmind.com',
      password: 'SecurePass123!'
    });

    console.log('Login successful!');
    console.log('User ID:', response.data.data.user.id);
    console.log('Tenant ID:', response.data.data.tenant.id);
    console.log('Access Token:', response.data.data.tokens.accessToken);

    return response.data.data;
  } catch (error) {
    if (error.response) {
      console.log('Login failed:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

async function testUpload(accessToken, tenantId) {
  try {
    console.log('\nTesting video upload...');
    console.log('Using token:', accessToken.substring(0, 20) + '...');
    console.log('Tenant ID:', tenantId);
    
    const FormData = require('form-data');
    const fs = require('fs');
    
    // Create a minimal valid MP4 file header (won't work for actual processing but should pass initial validation)
    const mp4Header = Buffer.from([
      0x00, 0x00, 0x00, 0x20, // box size
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6f, 0x6d, // 'isom'
      0x00, 0x00, 0x02, 0x00, // minor version
      0x69, 0x73, 0x6f, 0x6d, // compatible brands
      0x69, 0x73, 0x6f, 0x32,
      0x6d, 0x70, 0x34, 0x31
    ]);
    
    const testFilePath = '/tmp/test-video.mp4';
    fs.writeFileSync(testFilePath, mp4Header);
    
    const form = new FormData();
    form.append('video', fs.createReadStream(testFilePath), {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });

    console.log('Making request to:', `${BASE_URL}/tenants/${tenantId}/processes`);

    const response = await axios.post(
      `${BASE_URL}/tenants/${tenantId}/processes`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );

    console.log('Upload successful!');
    console.log('Process ID:', response.data.data.process.id);
    console.log('Status:', response.data.data.process.status);

    // Cleanup
    fs.unlinkSync(testFilePath);

    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('Upload failed:', JSON.stringify(error.response.data, null, 2));
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    } else {
      console.log('Network/Request Error:', error.message);
      if (error.code) console.log('Error Code:', error.code);
    }
    return null;
  }
}

async function main() {
  console.log('=== Testing Process Mind Authentication ===\n');

  // Try to login first (in case user already exists)
  let authData = await loginUser();
  
  if (!authData) {
    console.log('\nLogin failed, trying to register new user...');
    authData = await registerUser();
  }

  if (authData) {
    console.log('\n=== Testing Upload with Authentication ===');
    await testUpload(authData.tokens.accessToken, authData.tenant.id);
  }
}

main().catch(console.error);