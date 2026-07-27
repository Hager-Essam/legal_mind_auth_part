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

  async sendVerificationEmail(to: string, verificationToken: string, userName: string) {
    const verificationUrl = `${config.app.clientUrl}/verify-email?token=${verificationToken}`;

    if (config.nodeEnv !== 'production') {
      console.log(`🔗 [DEV] Email verification URL for ${to}: ${verificationUrl}`);
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Tahoma, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              direction: rtl;
              text-align: right;
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
              <h2>تفعيل عنوان بريدك الإلكتروني</h2>
              <p>مرحبًا ${userName}،</p>
              <p>شكرًا لتسجيلك في LegalMind! يرجى تأكيد عنوان بريدك الإلكتروني بالضغط على الزر أدناه:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">تفعيل البريد الإلكتروني</a>
              </div>
              <p>أو انسخ هذا الرابط والصقه في متصفحك:</p>
              <p style="word-break: break-all; color: #3498db;">${verificationUrl}</p>
              <div class="warning">
                <strong>⚠️ ملاحظة:</strong>
                <ul>
                  <li>ستنتهي صلاحية هذا الرابط خلال 24 ساعة</li>
                  <li>لن تتمكن من تسجيل الدخول حتى يتم تفعيل بريدك الإلكتروني</li>
                  <li>إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. جميع الحقوق محفوظة.</p>
              <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'تفعيل بريدك الإلكتروني - LegalMind', html);
  }

  async sendPasswordResetEmail(to: string, resetToken: string, userName: string) {
    if (config.nodeEnv !== 'production') {
      console.log(`🔗 [DEV] Password reset URL for ${to}: ${config.app.clientUrl}/reset-password?token=${resetToken}`);
    }

    const resetUrl = `${config.app.clientUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Tahoma, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              direction: rtl;
              text-align: right;
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
              <h2>طلب إعادة تعيين كلمة المرور</h2>
              <p>مرحبًا ${userName}،</p>
              <p>تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك. اضغط على الزر أدناه لإنشاء كلمة مرور جديدة:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">إعادة تعيين كلمة المرور</a>
              </div>
              <p>أو انسخ هذا الرابط والصقه في متصفحك:</p>
              <p style="word-break: break-all; color: #3498db;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ تنبيه أمني:</strong>
                <ul>
                  <li>ستنتهي صلاحية هذا الرابط خلال ساعة واحدة</li>
                  <li>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد الإلكتروني</li>
                  <li>لن تتغير كلمة المرور الخاصة بك ما لم تضغط على الرابط أعلاه وتنشئ كلمة مرور جديدة</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. جميع الحقوق محفوظة.</p>
              <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'طلب إعادة تعيين كلمة المرور - LegalMind', html);
  }

  async sendPasswordResetConfirmation(to: string, userName: string) {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Tahoma, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              direction: rtl;
              text-align: right;
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
              <h2>تمت إعادة تعيين كلمة المرور بنجاح</h2>
              <p>مرحبًا ${userName}،</p>
              <div class="success">
                <h3>✓ تم تغيير كلمة المرور بنجاح!</h3>
              </div>
              <p>يمكنك الآن تسجيل الدخول إلى حسابك باستخدام كلمة المرور الجديدة.</p>
              <p>إذا لم تقم بهذا التغيير، يرجى التواصل مع فريق الدعم فورًا.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. جميع الحقوق محفوظة.</p>
              <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'تم تغيير كلمة المرور - LegalMind', html);
  }

  async sendWelcomeEmail(to: string, userName: string) {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Tahoma, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              direction: rtl;
              text-align: right;
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
              <h1>مرحبًا بك في LegalMind!</h1>
            </div>
            <div class="content">
              <h2>مرحبًا ${userName}،</h2>
              <p>شكرًا لانضمامك إلى LegalMind! يسعدنا انضمامك إلينا.</p>
              <p>تم إنشاء حسابك بنجاح. يمكنك الآن الوصول إلى جميع ميزاتنا.</p>
              <div style="text-align: center;">
                <a href="${config.app.clientUrl}/login" class="button">ابدأ الآن</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 LegalMind. جميع الحقوق محفوظة.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, 'مرحبًا بك في LegalMind!', html);
  }
}

export default new EmailService();
