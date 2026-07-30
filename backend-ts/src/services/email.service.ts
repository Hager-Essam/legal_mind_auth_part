import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

type DevelopmentEmail = {
  to: string;
  subject: string;
  actionUrl?: string;
};

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
      })[character]!,
  );

export class EmailService {
  private transporter: Transporter | null = null;
  private lastDevelopmentEmail: DevelopmentEmail | null = null;

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

  private async send(
    to: string,
    subject: string,
    html: string,
    actionUrl?: string,
  ): Promise<void> {
    if (env.emailMode === "console") {
      if (env.nodeEnv !== "production") {
        this.lastDevelopmentEmail = { to, subject, actionUrl };
        console.info(
          `[Email:console] ${subject} to ${to}${actionUrl ? `: ${actionUrl}` : ""}`,
        );
      } else {
        console.info(`[Email:console] Suppressed ${subject} for ${to}.`);
      }
      return;
    }

    await this.getTransporter().sendMail({
      from: env.emailFrom,
      to,
      subject,
      html,
    });
  }

  async sendVerificationEmail(
    to: string,
    token: string,
    fullName: string,
  ): Promise<void> {
    const actionUrl = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      "Verify your LegalMind email",
      `<p>Hello ${escapeHtml(fullName)},</p><p>Verify your LegalMind email:</p><p><a href="${escapeHtml(actionUrl)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
      actionUrl,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    fullName: string,
  ): Promise<void> {
    const actionUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      "Reset your LegalMind password",
      `<p>Hello ${escapeHtml(fullName)},</p><p><a href="${escapeHtml(actionUrl)}">Reset password</a></p><p>This link expires in one hour.</p>`,
      actionUrl,
    );
  }

  async sendPasswordResetConfirmation(
    to: string,
    fullName: string,
  ): Promise<void> {
    await this.send(
      to,
      "Your LegalMind password was changed",
      `<p>Hello ${escapeHtml(fullName)},</p><p>Your password was changed. If this was not you, contact the project administrator immediately.</p>`,
    );
  }
}

