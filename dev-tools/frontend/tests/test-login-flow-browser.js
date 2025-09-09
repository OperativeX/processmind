// Browser Console Test Script for Login Flow
// Copy and paste this into your browser's developer console while on localhost:5001

(async function testCompleteLoginFlow() {
    console.log('🧪 AUTOMATED LOGIN FLOW TEST');
    console.log('==============================\n');

    const API_BASE = 'http://localhost:5000/api/v1';
    const TEST_CREDENTIALS = {
        email: 'testuser@processmind.com',
        password: 'SecurePass123!'
    };

    const STORAGE_KEYS = {
        ACCESS_TOKEN: 'process_mind_access_token',
        REFRESH_TOKEN: 'process_mind_refresh_token',
        USER: 'process_mind_user',
        TENANT: 'process_mind_tenant',
        EXPIRES_IN: 'process_mind_expires_in',
    };

    let testResults = {
        cleanup: false,
        backendConnection: false,
        directApiLogin: false,
        storageAfterLogin: false,
        authContextState: false,
        routingBehavior: false
    };

    // Step 1: Complete Cleanup
    console.log('1. 🧹 Performing complete auth cleanup...');
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        sessionStorage.clear();
        console.log('   ✅ Cleanup successful');
        testResults.cleanup = true;
    } catch (error) {
        console.error('   ❌ Cleanup failed:', error);
    }

    // Step 2: Test Backend Connection
    console.log('\n2. 🔌 Testing backend connection...');
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_CREDENTIALS)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Backend login API working');
            console.log('   📊 Response structure:', JSON.stringify({
                success: data.success,
                hasData: !!data.data,
                hasUser: !!data.data?.user,
                hasTenant: !!data.data?.tenant,
                hasTokens: !!data.data?.tokens
            }, null, 2));
            testResults.backendConnection = true;
            testResults.directApiLogin = true;
        } else {
            console.error('   ❌ Backend login failed:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('   ❌ Backend connection failed:', error.message);
    }

    // Step 3: Check Current Route
    console.log('\n3. 🗺️  Checking current route behavior...');
    console.log(`   Current URL: ${window.location.href}`);
    console.log(`   Current Path: ${window.location.pathname}`);

    if (window.location.pathname === '/login') {
        console.log('   ✅ Correctly on login page');
        testResults.routingBehavior = true;
    } else if (window.location.pathname === '/dashboard' || window.location.pathname === '/') {
        console.error('   ❌ ON DASHBOARD WITHOUT AUTH - BYPASS DETECTED!');
        console.error('   🔍 This indicates ProtectedRoute is not working correctly');
    }

    // Step 4: Check AuthContext State (if available)
    console.log('\n4. 🔍 Checking AuthContext state...');
    try {
        // Check if React DevTools or context is accessible
        if (window.React) {
            console.log('   ℹ️  React detected, but AuthContext not directly accessible');
            console.log('   💡 Check browser console for AuthContext debug logs');
        }
        console.log('   📋 localStorage after cleanup:');
        Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
            const value = localStorage.getItem(storageKey);
            console.log(`     ${key}: ${value ? 'EXISTS' : 'null'}`);
        });
    } catch (error) {
        console.error('   ❌ Context check failed:', error);
    }

    // Step 5: Automated Login Test (simulate form submission)
    console.log('\n5. 🤖 Attempting automated login simulation...');
    try {
        // Find login form elements
        const emailInput = document.querySelector('input[type="email"], input[name="email"]');
        const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
        const submitButton = document.querySelector('button[type="submit"], button:contains("Sign In")');

        if (emailInput && passwordInput && submitButton && window.location.pathname === '/login') {
            console.log('   📝 Login form found, filling credentials...');
            
            // Fill the form
            emailInput.value = TEST_CREDENTIALS.email;
            passwordInput.value = TEST_CREDENTIALS.password;
            
            // Trigger React events
            ['input', 'change'].forEach(eventType => {
                emailInput.dispatchEvent(new Event(eventType, { bubbles: true }));
                passwordInput.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            console.log('   🔘 Form filled. You can now manually click "Sign In" or we can auto-click...');
            console.log('   ⚠️  Auto-clicking in 3 seconds. Press ESC to cancel.');
            
            let cancelled = false;
            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    cancelled = true;
                    console.log('   ❌ Auto-click cancelled by user');
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            document.addEventListener('keydown', keyHandler);

            setTimeout(() => {
                document.removeEventListener('keydown', keyHandler);
                if (!cancelled) {
                    console.log('   🖱️  Auto-clicking submit button...');
                    submitButton.click();
                    
                    // Check result after a delay
                    setTimeout(() => {
                        console.log('\n📊 LOGIN RESULT CHECK:');
                        console.log(`   Current path: ${window.location.pathname}`);
                        
                        const hasTokens = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
                        console.log(`   Has auth tokens: ${!!hasTokens}`);
                        
                        if (window.location.pathname === '/dashboard' && hasTokens) {
                            console.log('   ✅ LOGIN SUCCESS - Redirected to dashboard with tokens');
                            testResults.authContextState = true;
                        } else if (window.location.pathname === '/dashboard' && !hasTokens) {
                            console.error('   ❌ BYPASS CONFIRMED - Dashboard without tokens!');
                        } else if (window.location.pathname === '/login') {
                            console.error('   ❌ Login failed or form error');
                        }
                    }, 3000);
                }
            }, 3000);

        } else {
            console.log('   ℹ️  Login form not found or not on login page');
            console.log('   💡 Manual test: Navigate to /login and enter credentials');
        }
    } catch (error) {
        console.error('   ❌ Automated login failed:', error);
    }

    // Step 6: Summary
    setTimeout(() => {
        console.log('\n📋 TEST SUMMARY:');
        console.log('================');
        Object.entries(testResults).forEach(([test, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
        });

        if (!testResults.routingBehavior) {
            console.log('\n🔍 PRIMARY ISSUE IDENTIFIED:');
            console.log('The app is not properly redirecting to /login when unauthenticated');
            console.log('This suggests an issue with:');
            console.log('- AuthContext initialization');
            console.log('- ProtectedRoute logic');
            console.log('- Token validation logic');
        }

        console.log('\n💡 NEXT STEPS:');
        console.log('1. Check browser console for AuthContext debug logs');
        console.log('2. Verify ProtectedRoute logs');
        console.log('3. Test manual login flow');
        console.log('4. Check for race conditions in auth initialization');

    }, 1000);

})();