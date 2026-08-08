import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";

type DevelopmentEmail = {
  to: string;
  subject: string;
  actionUrl?: string;
};

/** Brand tokens (aligned with LegalMind light theme — email-safe hex only). */
const brand = {
  name: "LegalMind",
  tagline: "الذكاء القانوني الموثوق",
  primary: "#003ec7",
  primaryDeep: "#0038b6",
  accent: "#d69e2e",
  canvas: "#e4e9f2",
  paper: "#f3f5f9",
  ink: "#1a1d24",
  muted: "#4a5060",
  border: "#b8c1d1",
  onPrimary: "#f7f9fc",
} as const;

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!
  );

type BrandedEmailContent = {
  preheader: string;
  title: string;
  greeting: string;
  bodyHtml: string;
  /** Primary CTA — omit for notice-only emails */
  cta?: { label: string; url: string };
  footnote?: string;
};

/**
 * Table-based RTL layout for maximum email-client support.
 * Identity: cool blue-gray canvas, soft paper card, brand blue CTA, gold accent bar.
 */
const renderBrandedEmail = (content: BrandedEmailContent): string => {
  const safeTitle = escapeHtml(content.title);
  const safePreheader = escapeHtml(content.preheader);
  const cta =
    content.cta != null
      ? `
      <tr>
        <td align="center" style="padding:8px 0 28px;">
          <a href="${escapeHtml(content.cta.url)}"
             style="display:inline-block;background:${brand.primary};color:${brand.onPrimary};font-family:Tahoma,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;border:1px solid ${brand.primaryDeep};">
            ${escapeHtml(content.cta.label)}
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 20px;font-family:Tahoma,Arial,sans-serif;font-size:12px;line-height:1.6;color:${brand.muted};word-break:break-all;">
          إذا لم يعمل الزر، انسخ الرابط التالي في المتصفح:<br/>
          <a href="${escapeHtml(content.cta.url)}" style="color:${brand.primary};text-decoration:underline;">${escapeHtml(content.cta.url)}</a>
        </td>
      </tr>`
      : "";

  const footnote = content.footnote
    ? `<p style="margin:0;font-family:Tahoma,Arial,sans-serif;font-size:12px;line-height:1.7;color:${brand.muted};">${content.footnote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:${brand.canvas};direction:rtl;">
  <!-- Preheader (hidden in most clients) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${safePreheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${brand.canvas};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${brand.paper};border:1px solid ${brand.border};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(28,45,80,0.08);">
          <!-- Gold brand accent -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg, ${brand.primary} 0%, ${brand.primaryDeep} 55%, ${brand.accent} 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:24px 28px 8px;background:${brand.paper};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Tahoma,Arial,sans-serif;">
                    <span style="display:inline-block;font-size:18px;font-weight:800;color:${brand.ink};letter-spacing:-0.02em;">
                      ${brand.name}<span style="color:${brand.primary};">.</span>
                    </span>
                    <div style="margin-top:4px;font-size:11px;color:${brand.muted};">${escapeHtml(brand.tagline)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:16px 28px 8px;">
              <h1 style="margin:0 0 16px;font-family:Tahoma,Arial,sans-serif;font-size:20px;line-height:1.35;font-weight:800;color:${brand.ink};">
                ${safeTitle}
              </h1>
              <p style="margin:0 0 12px;font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:${brand.ink};">
                ${content.greeting}
              </p>
              <div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.75;color:${brand.muted};">
                ${content.bodyHtml}
              </div>
            </td>
          </tr>

          ${cta}

          ${
            content.footnote
              ? `<tr>
            <td style="padding:0 28px 24px;">
              ${footnote}
            </td>
          </tr>`
              : ""
          }

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid ${brand.border};background:#eef2f8;">
              <p style="margin:0 0 6px;font-family:Tahoma,Arial,sans-serif;font-size:11px;line-height:1.6;color:${brand.muted};">
                هذه رسالة آلية من ${brand.name}. يُرجى عدم الرد على هذا البريد مباشرة.
              </p>
              <p style="margin:0;font-family:Tahoma,Arial,sans-serif;font-size:11px;color:${brand.muted};">
                © ${new Date().getFullYear()} ${brand.name} — منصة الاستشارة القانونية الذكية
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export class EmailService {
  private transporter: Transporter | null = null;
  private lastDevelopmentEmail: DevelopmentEmail | null = null;
  private readonly mode: "console" | "smtp";

  constructor(mode?: "console" | "smtp") {
    this.mode = env.nodeEnv === "production" ? env.emailMode : (mode ?? env.emailMode);
  }

  getLastDevelopmentEmail(): DevelopmentEmail | null {
    if (env.nodeEnv === "production") return null;
    return this.lastDevelopmentEmail;
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: env.emailHost,
      port: env.emailPort,
      secure: env.emailSecure,
      auth: { user: env.emailUser, pass: env.emailPassword },
    });
    return this.transporter;
  }

  private formatFrom(): string {
    const raw = env.emailFrom.trim();
    if (!raw) return `"${brand.name}" <noreply@legalmind.app>`;
    if (raw.includes("<") && raw.includes(">")) return raw;
    return `"${brand.name}" <${raw}>`;
  }

  private async send(to: string, subject: string, html: string, actionUrl?: string): Promise<void> {
    if (this.mode === "console") {
      if (env.nodeEnv !== "production") {
        this.lastDevelopmentEmail = { to, subject, actionUrl };
        console.info(`[Email:console] ${subject} to ${to}${actionUrl ? `: ${actionUrl}` : ""}`);
      } else {
        console.info(`[Email:console] Suppressed ${subject} for ${to}.`);
      }
      return;
    }

    await this.getTransporter().sendMail({
      from: this.formatFrom(),
      to,
      subject: `${brand.name} · ${subject}`,
      html,
    });
  }

  async sendVerificationEmail(to: string, token: string, fullName: string): Promise<void> {
    const actionUrl = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const name = escapeHtml(fullName.trim() || "مستشارنا");

    const html = renderBrandedEmail({
      preheader: "فعّل حسابك في LegalMind لمتابعة الاستشارات القانونية الذكية.",
      title: "تأكيد البريد الإلكتروني",
      greeting: `مرحباً ${name}،`,
      bodyHtml: `
        <p style="margin:0 0 12px;">شكراً لانضمامك إلى <strong style="color:${brand.ink};">${brand.name}</strong>.</p>
        <p style="margin:0 0 12px;">لتفعيل حسابك والوصول إلى غرفة المشورة وتحليل العقود، اضغط الزر أدناه للتحقق من بريدك الإلكتروني.</p>
      `,
      cta: { label: "تأكيد بريدي الإلكتروني", url: actionUrl },
      footnote:
        "ينتهي صلاحية هذا الرابط خلال <strong>24 ساعة</strong>. إذا لم تطلب إنشاء حساب، يمكنك تجاهل هذه الرسالة بأمان.",
    });

    await this.send(to, "تأكيد بريدك الإلكتروني", html, actionUrl);
  }

  async sendPasswordResetEmail(to: string, token: string, fullName: string): Promise<void> {
    const actionUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const name = escapeHtml(fullName.trim() || "مستشارنا");

    const html = renderBrandedEmail({
      preheader: "طلب إعادة تعيين كلمة المرور لحساب LegalMind.",
      title: "إعادة تعيين كلمة المرور",
      greeting: `مرحباً ${name}،`,
      bodyHtml: `
        <p style="margin:0 0 12px;">تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في ${brand.name}.</p>
        <p style="margin:0 0 12px;">اضغط الزر أدناه لاختيار كلمة مرور جديدة. إذا لم تطلب ذلك، تجاهل الرسالة ولن يُغيّر شيء.</p>
      `,
      cta: { label: "إعادة تعيين كلمة المرور", url: actionUrl },
      footnote: "ينتهي صلاحية هذا الرابط خلال <strong>ساعة واحدة</strong> لحماية حسابك.",
    });

    await this.send(to, "إعادة تعيين كلمة المرور", html, actionUrl);
  }

  async sendPasswordResetConfirmation(to: string, fullName: string): Promise<void> {
    const name = escapeHtml(fullName.trim() || "مستشارنا");
    const loginUrl = `${env.frontendUrl}/login`;

    const html = renderBrandedEmail({
      preheader: "تم تحديث كلمة مرور حسابك بنجاح على LegalMind.",
      title: "تم تحديث كلمة المرور",
      greeting: `مرحباً ${name}،`,
      bodyHtml: `
        <p style="margin:0 0 12px;">تم تغيير كلمة المرور لحسابك على ${brand.name} بنجاح.</p>
        <p style="margin:0 0 12px;">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة. إذا لم تقم بهذا التغيير، تواصل فوراً مع دعم المنصة.</p>
      `,
      cta: { label: "تسجيل الدخول", url: loginUrl },
      footnote: "لأمان حسابك، لا تشارك كلمة المرور مع أي طرف. فريق LegalMind لن يطلبها عبر البريد.",
    });

    await this.send(to, "تم تحديث كلمة المرور", html);
  }
}
