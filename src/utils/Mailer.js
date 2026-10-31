import nodemailer from 'nodemailer';
import ENV from '../config/env.js';

class PaymentMailer {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (!this.transporter) {
      if (ENV.EMAIL_USER && ENV.EMAIL_PASS) {
        this.transporter = nodemailer.createTransport({
          service: ENV.EMAIL_SERVICE || 'gmail',
          auth: {
            user: ENV.EMAIL_USER,
            pass: ENV.EMAIL_PASS.replace(/\s+/g, '').trim(),
          },
          connectionTimeout: 5000,
          socketTimeout: 5000,
        });
      }
    }
    return this.transporter;
  }

  async sendEmail({ to, subject, html, text }) {
    if (!to || !subject) return false;
    const transporter = this.getTransporter();
    if (!transporter) {
      console.log(`[PaymentMailer] Mock Email to ${to}: ${subject}`);
      return { mock: true };
    }

    try {
      const info = await transporter.sendMail({
        from: `"${ENV.EMAIL_FROM_NAME}" <${ENV.EMAIL_USER}>`,
        to,
        subject,
        html,
        text,
      });
      return info;
    } catch (err) {
      console.warn('[PaymentMailer] Failed to send email:', err.message);
      return false;
    }
  }
}

const mailer = new PaymentMailer();
export default mailer;

