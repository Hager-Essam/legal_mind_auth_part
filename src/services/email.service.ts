import nodemailer from "nodemailer";
import config from "../config/env";

/** Frontend production URL used in email action links */
const FRONTEND_URL = "https://legal-mind-front.vercel.app";

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
      console.log("✅ Email sent successfully!");
      console.log("📧 Message ID:", info.messageId);
      return info;
    } catch (error: any) {
      console.error("❌ Error sending email:");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendVerificationEmail(
    to: string,
    verificationToken: string,
    userName: string,
  ) {
    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

    if (config.nodeEnv !== "production") {
      console.log(
        `🔗 [DEV] Email verification URL for ${to}: ${verificationUrl}`,
      );
    }

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Language" content="ar" />
    <title>تفعيل البريد الإلكتروني — LegalMind</title>
  </head>
  <body dir="rtl" style="margin:0;padding:0;background-color:#eef2fb;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl !important;text-align:right !important;unicode-bidi:embed;-webkit-text-size-adjust:100%;">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2fb;padding:32px 12px;direction:rtl;text-align:right;">
      <tr>
        <td align="center" dir="rtl">
          <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6e0f5;box-shadow:0 8px 28px rgba(0,62,199,0.08);direction:rtl;text-align:right;">
            <tr>
              <td dir="rtl" align="right" style="background-color:#0b1326;background-image:linear-gradient(135deg,#0b1326 0%,#132347 55%,#0038b6 100%);padding:28px 28px 24px;direction:rtl;text-align:right;">
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl;">
                  <tr>
                    <td align="right" dir="rtl" style="vertical-align:middle;text-align:right;">
                      <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">ليجال مايند</span>
                      <span style="font-size:22px;font-weight:700;color:#d69e2e;margin-right:6px;">AI</span>
                    </td>
                    <td align="left" dir="rtl" style="vertical-align:middle;text-align:left;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background-color:rgba(214,158,46,0.15);border:1px solid rgba(214,158,46,0.35);color:#d69e2e;font-size:11px;font-weight:600;">تفعيل الحساب</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;color:#c4c6cf;font-size:12px;letter-spacing:0.04em;text-align:right;direction:rtl;">ذكاء قانوني دقيق · مساحة عمل آمنة</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background-color:#003ec7;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:36px 28px 12px;direction:rtl;text-align:right;">
                <p style="margin:0 0 8px;color:#003ec7;font-size:12px;font-weight:700;letter-spacing:0.06em;text-align:right;direction:rtl;">خطوة أخيرة</p>
                <h1 style="margin:0 0 16px;color:#191c1e;font-size:26px;line-height:1.35;font-weight:700;text-align:right;direction:rtl;">تفعيل عنوان بريدك الإلكتروني</h1>
                <p style="margin:0 0 12px;color:#191c1e;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">مرحبًا <strong style="color:#0038b6;">${userName}</strong>،</p>
                <p style="margin:0 0 28px;color:#434656;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">شكرًا لتسجيلك في <strong style="color:#191c1e;">ليجال مايند</strong>. أكّد بريدك الإلكتروني للمتابعة إلى مساحة عملك القانونية.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
                  <tr>
                    <td align="center" bgcolor="#003ec7" style="border-radius:10px;background-color:#003ec7;">
                      <a href="${verificationUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#003ec7;">تفعيل البريد الإلكتروني</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#434656;font-size:13px;line-height:1.7;text-align:right;direction:rtl;">أو انسخ الرابط التالي والصقه في متصفحك:</p>
                <p dir="ltr" style="margin:0 0 24px;padding:12px 14px;background-color:#f0f4ff;border:1px solid #d6e0f5;border-radius:10px;word-break:break-all;color:#003ec7;font-size:12px;line-height:1.7;text-align:left;direction:ltr;">${verificationUrl}</p>
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff9eb;border:1px solid #edd9a3;border-radius:12px;direction:rtl;">
                  <tr>
                    <td dir="rtl" align="right" style="padding:16px 18px;direction:rtl;text-align:right;">
                      <p style="margin:0 0 10px;color:#8a6a12;font-size:13px;font-weight:700;text-align:right;">ملاحظات مهمة</p>
                      <ul style="margin:0;padding:0 18px 0 0;color:#5c4a1a;font-size:13px;line-height:1.9;text-align:right;direction:rtl;">
                        <li>تنتهي صلاحية هذا الرابط خلال 24 ساعة</li>
                        <li>لن تتمكن من تسجيل الدخول قبل تفعيل بريدك</li>
                        <li>إذا لم تنشئ هذا الحساب، يمكنك تجاهل الرسالة بأمان</li>
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td dir="rtl" style="padding:28px;border-top:1px solid #e6eaf5;direction:rtl;text-align:center;">
                <p style="margin:0 0 6px;text-align:center;color:#737688;font-size:12px;direction:rtl;">© 2026 LegalMind AI · جميع الحقوق محفوظة</p>
                <p style="margin:0;text-align:center;color:#8e9099;font-size:11px;direction:rtl;">رسالة تلقائية — يُرجى عدم الرد على هذا البريد</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    return this.sendEmail(to, "تفعيل بريدك الإلكتروني - LegalMind", html);
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    userName: string,
  ) {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    if (config.nodeEnv !== "production") {
      console.log(`🔗 [DEV] Password reset URL for ${to}: ${resetUrl}`);
    }

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Language" content="ar" />
    <title>إعادة تعيين كلمة المرور — LegalMind</title>
  </head>
  <body dir="rtl" style="margin:0;padding:0;background-color:#eef2fb;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl !important;text-align:right !important;unicode-bidi:embed;-webkit-text-size-adjust:100%;">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2fb;padding:32px 12px;direction:rtl;text-align:right;">
      <tr>
        <td align="center" dir="rtl">
          <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6e0f5;box-shadow:0 8px 28px rgba(0,62,199,0.08);direction:rtl;text-align:right;">
            <tr>
              <td dir="rtl" align="right" style="background-color:#0b1326;background-image:linear-gradient(135deg,#0b1326 0%,#132347 55%,#0038b6 100%);padding:28px 28px 24px;direction:rtl;text-align:right;">
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl;">
                  <tr>
                    <td align="right" dir="rtl" style="vertical-align:middle;text-align:right;">
                      <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">ليجال مايند</span>
                      <span style="font-size:22px;font-weight:700;color:#d69e2e;margin-right:6px;">AI</span>
                    </td>
                    <td align="left" dir="rtl" style="vertical-align:middle;text-align:left;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background-color:rgba(214,158,46,0.15);border:1px solid rgba(214,158,46,0.35);color:#d69e2e;font-size:11px;font-weight:600;">أمان الحساب</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;color:#c4c6cf;font-size:12px;letter-spacing:0.04em;text-align:right;direction:rtl;">استعادة آمنة لكلمة المرور</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background-color:#003ec7;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:36px 28px 12px;direction:rtl;text-align:right;">
                <p style="margin:0 0 8px;color:#003ec7;font-size:12px;font-weight:700;letter-spacing:0.06em;text-align:right;direction:rtl;">طلب استعادة</p>
                <h1 style="margin:0 0 16px;color:#191c1e;font-size:26px;line-height:1.35;font-weight:700;text-align:right;direction:rtl;">إعادة تعيين كلمة المرور</h1>
                <p style="margin:0 0 12px;color:#191c1e;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">مرحبًا <strong style="color:#0038b6;">${userName}</strong>،</p>
                <p style="margin:0 0 28px;color:#434656;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك في ليجال مايند. إذا كنت أنت من طلب ذلك، اضغط الزر أدناه لإنشاء كلمة مرور جديدة.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
                  <tr>
                    <td align="center" bgcolor="#003ec7" style="border-radius:10px;background-color:#003ec7;">
                      <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#003ec7;">إعادة تعيين كلمة المرور</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#434656;font-size:13px;line-height:1.7;text-align:right;direction:rtl;">أو انسخ الرابط التالي والصقه في متصفحك:</p>
                <p dir="ltr" style="margin:0 0 24px;padding:12px 14px;background-color:#f0f4ff;border:1px solid #d6e0f5;border-radius:10px;word-break:break-all;color:#003ec7;font-size:12px;line-height:1.7;text-align:left;direction:ltr;">${resetUrl}</p>
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff9eb;border:1px solid #edd9a3;border-radius:12px;direction:rtl;">
                  <tr>
                    <td dir="rtl" align="right" style="padding:16px 18px;direction:rtl;text-align:right;">
                      <p style="margin:0 0 10px;color:#8a6a12;font-size:13px;font-weight:700;text-align:right;">تنبيه أمني</p>
                      <ul style="margin:0;padding:0 18px 0 0;color:#5c4a1a;font-size:13px;line-height:1.9;text-align:right;direction:rtl;">
                        <li>تنتهي صلاحية هذا الرابط خلال ساعة واحدة</li>
                        <li>إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة</li>
                        <li>لن تتغير كلمة المرور إلا بعد إنشاء كلمة جديدة من الرابط</li>
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td dir="rtl" style="padding:28px;border-top:1px solid #e6eaf5;direction:rtl;text-align:center;">
                <p style="margin:0 0 6px;text-align:center;color:#737688;font-size:12px;direction:rtl;">© 2026 LegalMind AI · جميع الحقوق محفوظة</p>
                <p style="margin:0;text-align:center;color:#8e9099;font-size:11px;direction:rtl;">رسالة تلقائية — يُرجى عدم الرد على هذا البريد</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    return this.sendEmail(to, "طلب إعادة تعيين كلمة المرور - LegalMind", html);
  }

  async sendPasswordResetConfirmation(to: string, userName: string) {
    const loginUrl = `${FRONTEND_URL}/login`;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Language" content="ar" />
    <title>تم تغيير كلمة المرور — LegalMind</title>
  </head>
  <body dir="rtl" style="margin:0;padding:0;background-color:#eef2fb;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl !important;text-align:right !important;unicode-bidi:embed;-webkit-text-size-adjust:100%;">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2fb;padding:32px 12px;direction:rtl;text-align:right;">
      <tr>
        <td align="center" dir="rtl">
          <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6e0f5;box-shadow:0 8px 28px rgba(0,62,199,0.08);direction:rtl;text-align:right;">
            <tr>
              <td dir="rtl" align="right" style="background-color:#0b1326;background-image:linear-gradient(135deg,#0b1326 0%,#132347 55%,#0038b6 100%);padding:28px 28px 24px;direction:rtl;text-align:right;">
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl;">
                  <tr>
                    <td align="right" dir="rtl" style="vertical-align:middle;text-align:right;">
                      <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">ليجال مايند</span>
                      <span style="font-size:22px;font-weight:700;color:#d69e2e;margin-right:6px;">AI</span>
                    </td>
                    <td align="left" dir="rtl" style="vertical-align:middle;text-align:left;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background-color:rgba(15,123,74,0.18);border:1px solid rgba(15,123,74,0.4);color:#7ddea8;font-size:11px;font-weight:600;">تأكيد ناجح</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;color:#c4c6cf;font-size:12px;letter-spacing:0.04em;text-align:right;direction:rtl;">حسابك محمٍ ومحدّث</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background-color:#0f7b4a;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:36px 28px 12px;direction:rtl;text-align:right;">
                <p style="margin:0 0 8px;color:#0f7b4a;font-size:12px;font-weight:700;letter-spacing:0.06em;text-align:right;direction:rtl;">تم بنجاح</p>
                <h1 style="margin:0 0 16px;color:#191c1e;font-size:26px;line-height:1.35;font-weight:700;text-align:right;direction:rtl;">تمت إعادة تعيين كلمة المرور</h1>
                <p style="margin:0 0 20px;color:#191c1e;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">مرحبًا <strong style="color:#0038b6;">${userName}</strong>،</p>
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#edf8f2;border:1px solid #b7e0c8;border-radius:12px;margin-bottom:24px;direction:rtl;">
                  <tr>
                    <td dir="rtl" style="padding:20px 18px;text-align:center;direction:rtl;">
                      <p style="margin:0;color:#0f7b4a;font-size:18px;font-weight:700;">تم تغيير كلمة المرور بنجاح</p>
                      <p style="margin:8px 0 0;color:#2f6b4d;font-size:13px;line-height:1.7;">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px;color:#434656;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">إذا لم تقم بهذا التغيير، تواصل مع فريق الدعم فورًا لحماية حسابك.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
                  <tr>
                    <td align="center" bgcolor="#003ec7" style="border-radius:10px;background-color:#003ec7;">
                      <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#003ec7;">تسجيل الدخول</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td dir="rtl" style="padding:28px;border-top:1px solid #e6eaf5;direction:rtl;text-align:center;">
                <p style="margin:0 0 6px;text-align:center;color:#737688;font-size:12px;direction:rtl;">© 2026 LegalMind AI · جميع الحقوق محفوظة</p>
                <p style="margin:0;text-align:center;color:#8e9099;font-size:11px;direction:rtl;">رسالة تلقائية — يُرجى عدم الرد على هذا البريد</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    return this.sendEmail(to, "تم تغيير كلمة المرور - LegalMind", html);
  }

  async sendWelcomeEmail(to: string, userName: string) {
    const loginUrl = `${FRONTEND_URL}/login`;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Language" content="ar" />
    <title>مرحبًا بك في LegalMind</title>
  </head>
  <body dir="rtl" style="margin:0;padding:0;background-color:#eef2fb;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl !important;text-align:right !important;unicode-bidi:embed;-webkit-text-size-adjust:100%;">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2fb;padding:32px 12px;direction:rtl;text-align:right;">
      <tr>
        <td align="center" dir="rtl">
          <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6e0f5;box-shadow:0 8px 28px rgba(0,62,199,0.08);direction:rtl;text-align:right;">
            <tr>
              <td dir="rtl" align="right" style="background-color:#0b1326;background-image:linear-gradient(135deg,#0b1326 0%,#132347 55%,#0038b6 100%);padding:32px 28px 28px;direction:rtl;text-align:right;">
                <p style="margin:0 0 14px;text-align:right;direction:rtl;">
                  <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">ليجال مايند</span>
                  <span style="font-size:22px;font-weight:700;color:#d69e2e;margin-right:6px;">AI</span>
                </p>
                <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;line-height:1.35;font-weight:700;text-align:right;direction:rtl;">مرحبًا بك في مساحة العمل</h1>
                <p style="margin:0;color:#c4c6cf;font-size:14px;line-height:1.7;text-align:right;direction:rtl;">نختصر وقت الكتابة... لنمنح الحجة ما تستحقه من إتقان.</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background-color:#d69e2e;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:36px 28px 12px;direction:rtl;text-align:right;">
                <p style="margin:0 0 12px;color:#191c1e;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">مرحبًا <strong style="color:#0038b6;">${userName}</strong>،</p>
                <p style="margin:0 0 16px;color:#434656;font-size:15px;line-height:1.8;text-align:right;direction:rtl;">يسعدنا انضمامك إلى <strong style="color:#191c1e;">ليجال مايند</strong>. تم إنشاء حسابك بنجاح، ويمكنك الآن الاستفادة من أدوات الصياغة والمراجعة والاستشارة الذكية.</p>
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;direction:rtl;">
                  <tr>
                    <td dir="rtl" align="right" style="padding:14px 16px;background-color:#f0f4ff;border:1px solid #d6e0f5;border-radius:12px;direction:rtl;text-align:right;">
                      <p style="margin:0 0 6px;color:#003ec7;font-size:13px;font-weight:700;text-align:right;">جاهز للبدء؟</p>
                      <p style="margin:0;color:#434656;font-size:13px;line-height:1.7;text-align:right;">ادخل إلى بوابتك وابدأ أول مستند أو استشارة قانونية خلال دقائق.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
                  <tr>
                    <td align="center" bgcolor="#003ec7" style="border-radius:10px;background-color:#003ec7;">
                      <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#003ec7;">ابدأ الآن</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td dir="rtl" style="padding:28px;border-top:1px solid #e6eaf5;direction:rtl;text-align:center;">
                <p style="margin:0 0 6px;text-align:center;color:#737688;font-size:12px;direction:rtl;">© 2026 LegalMind AI · جميع الحقوق محفوظة</p>
                <p style="margin:0;text-align:center;color:#8e9099;font-size:11px;direction:rtl;">رسالة تلقائية — يُرجى عدم الرد على هذا البريد</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    return this.sendEmail(to, "مرحبًا بك في LegalMind!", html);
  }
}

export default new EmailService();
