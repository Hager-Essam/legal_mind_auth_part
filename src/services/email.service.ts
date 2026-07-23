import nodemailer from 'nodemailer';
import config from '../config/env';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
    };

    try {
      console.log(`📧 Sending email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully!');
      console.log('📧 Message ID:', info.messageId);
      return info;
    } catch (error: any) {
      console.error('❌ Error sending email:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, userName: string) {
    const resetUrl = `${config.app.clientUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #2c3e50;
              color: white;
              padding: 20px;
              text-align: center;
            }
            .content {
              padding: 20px;
              background-color: #f9f9f9;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #3498db;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #777;
            }
            .warning {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              padding: 10px;
              border-radius: 5px;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>LegalMind</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hi ${userName},</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #3498db;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request a password reset, please ignore this email</li>
                  <li>Your password won't change unless you click the link above and create a new one</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'Password Reset Request - LegalMind', html);
  }

  async sendPasswordResetConfirmation(to: string, userName: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #2c3e50;
              color: white;
              padding: 20px;
              text-align: center;
            }
            .content {
              padding: 20px;
              background-color: #f9f9f9;
            }
            .success {
              background-color: #d4edda;
              border: 1px solid #28a745;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
              text-align: center;
            }
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #777;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>LegalMind</h1>
            </div>
            <div class="content">
              <h2>Password Successfully Reset</h2>
              <p>Hi ${userName},</p>
              <div class="success">
                <h3>✓ Your password has been changed successfully!</h3>
              </div>
              <p>You can now log in to your account using your new password.</p>
              <p>If you didn't make this change, please contact our support team immediately.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'Password Changed - LegalMind', html);
  }

  async sendWelcomeEmail(to: string, userName: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #2c3e50;
              color: white;
              padding: 20px;
              text-align: center;
            }
            .content {
              padding: 20px;
              background-color: #f9f9f9;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #3498db;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #777;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to LegalMind!</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Thank you for joining LegalMind! We're excited to have you on board.</p>
              <p>Your account has been created successfully. You can now access all our features.</p>
              <div style="text-align: center;">
                <a href="${config.app.clientUrl}/login" class="button">Get Started</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'Welcome to LegalMind!', html);
  }
}

export default new EmailService();
