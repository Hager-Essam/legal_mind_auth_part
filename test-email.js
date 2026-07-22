/**
 * Email Testing Script
 * Run: node test-email.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('📧 Testing Email Configuration\n');
  
  console.log('Configuration:');
  console.log('  Host:', process.env.EMAIL_HOST);
  console.log('  Port:', process.env.EMAIL_PORT);
  console.log('  User:', process.env.EMAIL_USER);
  console.log('  Password:', process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET');
  console.log('');

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  console.log('🔍 Verifying connection...');
  
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    console.log('📤 Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'LegalMind - Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2c3e50;">✅ Email Configuration Working!</h2>
          <p>Your LegalMind email service is configured correctly.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>Host: ${process.env.EMAIL_HOST}</li>
            <li>Port: ${process.env.EMAIL_PORT}</li>
            <li>User: ${process.env.EMAIL_USER}</li>
          </ul>
          <p>You're ready to send password reset emails!</p>
        </div>
      `,
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your inbox:', process.env.EMAIL_USER);
    console.log('\n✨ Email service is working perfectly!');
    
  } catch (error) {
    console.error('❌ Email test failed!\n');
    console.error('Error:', error.message);
    console.error('\n💡 Common issues:');
    console.error('1. Check EMAIL_USER and EMAIL_PASSWORD in .env');
    console.error('2. For Gmail: Use App Password, not regular password');
    console.error('3. Enable 2FA: https://myaccount.google.com/security');
    console.error('4. Generate App Password: https://myaccount.google.com/apppasswords');
  }
  
  process.exit(0);
}

testEmail();
