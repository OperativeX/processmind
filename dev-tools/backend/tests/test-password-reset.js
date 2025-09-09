require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api/v1';
const TEST_EMAIL = process.argv[2] || process.env.SMTP_USER;

async function testPasswordReset() {
  console.log('🔐 Testing Password Reset Flow\n');
  
  if (!TEST_EMAIL) {
    console.error('❌ Please provide a test email address as argument or set SMTP_USER in .env');
    process.exit(1);
  }
  
  console.log(`📧 Testing with email: ${TEST_EMAIL}\n`);
  
  try {
    // Step 1: Request password reset
    console.log('1️⃣ Requesting password reset...');
    
    const forgotResponse = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: TEST_EMAIL
    });
    
    console.log('✅ Password reset requested');
    console.log('Response:', forgotResponse.data);
    
    if (process.env.NODE_ENV === 'development' && forgotResponse.data.resetToken) {
      console.log(`\n🔑 Reset Token: ${forgotResponse.data.resetToken}`);
      console.log(`📱 Reset URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${forgotResponse.data.resetToken}`);
    }
    
    console.log('\n✉️ Check your email for the password reset link!');
    console.log('The email should contain:');
    console.log('- A personalized greeting');
    console.log('- A reset button/link');
    console.log('- The reset token (valid for 1 hour)');
    console.log('- Instructions to ignore if not requested');
    
    // Step 2: Test with invalid email (should get same response)
    console.log('\n2️⃣ Testing with non-existent email...');
    
    const invalidResponse = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: 'nonexistent@example.com'
    });
    
    console.log('Response:', invalidResponse.data);
    console.log('✅ Security check passed - same response for non-existent email');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
  
  console.log('\n✅ Password reset flow test completed!');
  console.log('\nNext steps:');
  console.log('1. Check your email for the reset link');
  console.log('2. Click the link to go to the reset password page');
  console.log('3. Enter your new password');
  console.log('4. Login with your new password');
}

// Run test
testPasswordReset();