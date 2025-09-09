require('dotenv').config();
const emailService = require('./src/services/emailService');
const logger = require('./src/utils/logger');

async function testEmailService() {
  console.log('🧪 Testing Email Service\n');
  
  try {
    // Initialize email service
    console.log('1️⃣ Initializing email service...');
    await emailService.initialize();
    console.log('✅ Email service initialized\n');
    
    // Test email configuration
    console.log('📋 Email Configuration:');
    console.log(`Provider: ${process.env.EMAIL_PROVIDER}`);
    console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`SMTP Port: ${process.env.SMTP_PORT}`);
    console.log(`From: ${process.env.SMTP_FROM}`);
    console.log(`From Name: ${process.env.SMTP_FROM_NAME}\n`);
    
    // Get test email from command line or use default
    const testEmail = process.argv[2] || process.env.SMTP_USER;
    
    if (!testEmail) {
      console.error('❌ Please provide a test email address as argument or set SMTP_USER in .env');
      process.exit(1);
    }
    
    console.log(`📧 Sending test emails to: ${testEmail}\n`);
    
    // Test 1: Verification Email
    console.log('2️⃣ Testing verification email...');
    const verificationCode = '123456';
    const verificationSent = await emailService.sendVerificationEmail(testEmail, verificationCode, {
      firstName: 'Test',
      tenantName: 'ACME Corporation'
    });
    
    if (verificationSent) {
      console.log('✅ Verification email sent successfully!\n');
    } else {
      console.log('❌ Failed to send verification email\n');
    }
    
    // Test 2: Password Reset Email
    console.log('3️⃣ Testing password reset email...');
    const resetToken = 'test-reset-token-' + Date.now();
    const resetSent = await emailService.sendPasswordResetEmail(testEmail, resetToken, {
      firstName: 'Test'
    });
    
    if (resetSent) {
      console.log('✅ Password reset email sent successfully!\n');
    } else {
      console.log('❌ Failed to send password reset email\n');
    }
    
    // Test 3: Welcome Email
    console.log('4️⃣ Testing welcome email...');
    const welcomeSent = await emailService.sendWelcomeEmail(testEmail, {
      firstName: 'Test',
      tenantName: 'ACME Corporation'
    });
    
    if (welcomeSent) {
      console.log('✅ Welcome email sent successfully!\n');
    } else {
      console.log('❌ Failed to send welcome email\n');
    }
    
    // Test 4: Custom Email
    console.log('5️⃣ Testing custom email...');
    const customSent = await emailService.sendEmail(
      testEmail,
      'Test Email from Process Mind',
      '<h1>Test Email</h1><p>This is a test email from Process Mind.</p>',
      'This is a test email from Process Mind.'
    );
    
    if (customSent) {
      console.log('✅ Custom email sent successfully!\n');
    } else {
      console.log('❌ Failed to send custom email\n');
    }
    
    // Summary
    console.log('📊 Test Summary:');
    console.log(`Verification Email: ${verificationSent ? '✅' : '❌'}`);
    console.log(`Password Reset Email: ${resetSent ? '✅' : '❌'}`);
    console.log(`Welcome Email: ${welcomeSent ? '✅' : '❌'}`);
    console.log(`Custom Email: ${customSent ? '✅' : '❌'}`);
    
    const allPassed = verificationSent && resetSent && welcomeSent && customSent;
    console.log(`\n${allPassed ? '✅ All tests passed!' : '⚠️ Some tests failed'}`);
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run tests
testEmailService();