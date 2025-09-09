require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSMTPConnection() {
  console.log('🔌 Testing SMTP Connection\n');
  
  console.log('Configuration:');
  console.log(`Host: ${process.env.SMTP_HOST}`);
  console.log(`Port: ${process.env.SMTP_PORT}`);
  console.log(`Secure: ${process.env.SMTP_SECURE}`);
  console.log(`User: ${process.env.SMTP_USER}`);
  console.log(`From: ${process.env.SMTP_FROM}\n`);
  
  // Test different configurations
  const configs = [
    {
      name: 'Port 465 with SSL',
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    },
    {
      name: 'Port 587 with STARTTLS',
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    },
    {
      name: 'Port 25 (standard SMTP)',
      host: process.env.SMTP_HOST,
      port: 25,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    }
  ];
  
  for (const config of configs) {
    console.log(`\nTesting ${config.name}...`);
    
    try {
      const transporter = nodemailer.createTransporter({
        ...config,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        logger: true,
        debug: true
      });
      
      await transporter.verify();
      console.log(`✅ ${config.name} - CONNECTION SUCCESSFUL!`);
      
      // Try to send a test email
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.SMTP_USER,
        subject: 'Process Mind - SMTP Test',
        text: 'This is a test email from Process Mind SMTP connection test.',
        html: '<p>This is a <b>test email</b> from Process Mind SMTP connection test.</p>'
      });
      
      console.log(`✅ Test email sent! Message ID: ${info.messageId}`);
      
      // This configuration works, update .env
      console.log('\n📝 To use this configuration, update your .env file:');
      console.log(`SMTP_PORT=${config.port}`);
      console.log(`SMTP_SECURE=${config.secure}`);
      
      break; // Stop testing once we find a working configuration
      
    } catch (error) {
      console.log(`❌ ${config.name} - Failed: ${error.message}`);
    }
  }
  
  console.log('\n📋 Troubleshooting tips:');
  console.log('1. Check if your firewall allows outgoing connections on SMTP ports');
  console.log('2. Verify your email credentials are correct');
  console.log('3. Some ISPs block port 25, try 587 or 465 instead');
  console.log('4. For Strato, you might need to enable SMTP in your account settings');
  console.log('5. Consider using an app-specific password if 2FA is enabled');
}

// Run test
testSMTPConnection().catch(console.error);