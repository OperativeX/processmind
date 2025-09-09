// Backend API Test Script - Run with Node.js
// Usage: node test-backend-api.js

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/v1';
const TEST_CREDENTIALS = {
    email: 'testuser@processmind.com',
    password: 'SecurePass123!'
};

async function testBackendAPI() {
    console.log('🧪 BACKEND API COMPREHENSIVE TEST');
    console.log('==================================\n');

    let testResults = {
        serverHealth: false,
        loginEndpoint: false,
        loginResponseStructure: false,
        tokenRefresh: false,
        authenticatedEndpoint: false,
        logoutEndpoint: false
    };

    // Test 1: Server Health Check
    console.log('1. 🔌 Testing server health...');
    try {
        // Try multiple health check endpoints
        let response = null;
        const healthUrls = [
            `${API_BASE_URL}/health`,
            `${API_BASE_URL}/public/health`, 
            `http://localhost:5000/health`,
            `http://localhost:5000/api/v1/public/health`
        ];
        
        for (const url of healthUrls) {
            try {
                response = await axios.get(url, { timeout: 5000 });
                if (response.status === 200) {
                    console.log(`   ✅ Server is running and healthy (${url})`);
                    testResults.serverHealth = true;
                    break;
                }
            } catch (err) {
                console.log(`   🔍 Tried ${url}: ${err.message}`);
            }
        }
        
        if (!testResults.serverHealth) {
            throw new Error('All health check endpoints failed');
        }
    } catch (error) {
        console.error('   ❌ Server health check failed');
        console.error('   🔧 Make sure backend is running: cd backend && npm start');
        // Don't return, continue with login test anyway
    }

    // Test 2: Login Endpoint
    console.log('\n2. 🔐 Testing login endpoint...');
    let loginResponse, tokens, user, tenant;
    try {
        loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, TEST_CREDENTIALS);
        console.log('   ✅ Login endpoint responding');
        console.log(`   📊 Status: ${loginResponse.status}`);
        console.log('   📊 Response headers:', Object.keys(loginResponse.headers));
        testResults.loginEndpoint = true;

        // Test 3: Response Structure
        console.log('\n3. 🏗️  Analyzing response structure...');
        const data = loginResponse.data;
        console.log('   📋 Top-level keys:', Object.keys(data));
        
        if (data.success && data.data) {
            console.log('   📋 Data keys:', Object.keys(data.data));
            
            user = data.data.user;
            tenant = data.data.tenant;
            tokens = data.data.tokens;
            
            console.log('   👤 User data:', {
                email: user?.email,
                id: user?.id,
                hasProfile: !!user
            });
            
            console.log('   🏢 Tenant data:', {
                name: tenant?.name,
                id: tenant?.id,
                hasTenant: !!tenant
            });
            
            console.log('   🔑 Token data:', {
                hasAccessToken: !!tokens?.accessToken,
                hasRefreshToken: !!tokens?.refreshToken,
                accessTokenLength: tokens?.accessToken?.length,
                expiresIn: tokens?.expiresIn
            });
            
            if (user && tenant && tokens && tokens.accessToken && tokens.refreshToken) {
                console.log('   ✅ Response structure is correct');
                testResults.loginResponseStructure = true;
            } else {
                console.error('   ❌ Response structure is incomplete');
            }
        } else {
            console.error('   ❌ Unexpected response structure:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('   ❌ Login endpoint failed:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
    }

    // Test 4: Token Refresh
    if (tokens?.refreshToken) {
        console.log('\n4. 🔄 Testing token refresh...');
        try {
            const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken: tokens.refreshToken
            });
            
            console.log('   ✅ Token refresh successful');
            console.log('   📊 Refresh response keys:', Object.keys(refreshResponse.data || {}));
            
            if (refreshResponse.data?.data?.accessToken) {
                console.log('   ✅ New access token received');
                testResults.tokenRefresh = true;
                // Update tokens for next test
                tokens.accessToken = refreshResponse.data.data.accessToken;
            } else {
                console.error('   ❌ No access token in refresh response');
            }
            
        } catch (error) {
            console.error('   ❌ Token refresh failed:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
        }
    } else {
        console.log('\n4. ❌ Skipping token refresh - no refresh token available');
    }

    // Test 5: Authenticated Endpoint
    if (tokens?.accessToken && tenant?.id) {
        console.log('\n5. 🔒 Testing authenticated endpoint...');
        try {
            const processResponse = await axios.get(
                `${API_BASE_URL}/tenants/${tenant.id}/processes`,
                {
                    headers: {
                        'Authorization': `Bearer ${tokens.accessToken}`
                    }
                }
            );
            
            console.log('   ✅ Authenticated endpoint working');
            console.log(`   📊 Status: ${processResponse.status}`);
            console.log('   📊 Response keys:', Object.keys(processResponse.data || {}));
            
            if (processResponse.data?.data?.processes) {
                console.log(`   📋 Found ${processResponse.data.data.processes.length} processes`);
                console.log('   📊 Pagination:', processResponse.data.data.pagination);
                testResults.authenticatedEndpoint = true;
            }
            
        } catch (error) {
            console.error('   ❌ Authenticated endpoint failed:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
        }
    } else {
        console.log('\n5. ❌ Skipping authenticated test - no tokens or tenant ID');
    }

    // Test 6: Logout
    if (tokens?.refreshToken) {
        console.log('\n6. 🚪 Testing logout endpoint...');
        try {
            const logoutResponse = await axios.post(`${API_BASE_URL}/auth/logout`, {
                refreshToken: tokens.refreshToken
            });
            
            console.log('   ✅ Logout successful');
            console.log(`   📊 Status: ${logoutResponse.status}`);
            testResults.logoutEndpoint = true;
            
        } catch (error) {
            console.error('   ❌ Logout failed:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
        }
    } else {
        console.log('\n6. ❌ Skipping logout test - no refresh token');
    }

    // Results Summary
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('=========================');
    Object.entries(testResults).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test.padEnd(25)}: ${passed ? 'PASS' : 'FAIL'}`);
    });

    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.values(testResults).length;
    console.log(`\n📋 Overall: ${passedTests}/${totalTests} tests passed`);

    // Specific Frontend Integration Notes
    console.log('\n🔍 FRONTEND INTEGRATION ANALYSIS:');
    console.log('===================================');
    
    if (testResults.loginResponseStructure) {
        console.log('✅ Backend API structure is correct for frontend integration');
        console.log('   - Response format: { success: true, data: { user, tenant, tokens } }');
        console.log('   - All required fields present');
    } else {
        console.error('❌ Backend API structure issues detected');
        console.error('   - Frontend AuthContext expects specific response format');
        console.error('   - Check login endpoint response structure');
    }

    if (testResults.tokenRefresh) {
        console.log('✅ Token refresh working - automatic re-authentication possible');
    } else {
        console.error('❌ Token refresh broken - users will be logged out on token expiry');
    }

    console.log('\n💡 NEXT STEPS FOR FRONTEND DEBUG:');
    console.log('1. If all backend tests pass, issue is in frontend AuthContext');
    console.log('2. Check AuthContext token refresh logic');
    console.log('3. Verify localStorage read/write operations');
    console.log('4. Check ProtectedRoute evaluation logic');
}

// Run the test
testBackendAPI().catch(error => {
    console.error('🚨 Test script failed:', error.message);
    process.exit(1);
});