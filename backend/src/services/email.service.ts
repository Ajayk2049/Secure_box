import { Resend } from "resend";
import { config } from "../config.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (config.resendApiKey) {
      this.resend = new Resend(config.resendApiKey);
    }
  }

  async sendDeliveryNotification(
    to: string,
    deviceName: string
  ): Promise<void> {
    if (!this.resend) {
      console.log("📧 Email service not configured, skipping notification");
      return;
    }

    const safeDeviceName = escapeHtml(deviceName || "Secure Box");

    try {
      await this.resend.emails.send({
        from: "Secure Box <noreply@yourdomain.com>",
        to,
        subject: `Parcel Delivered to ${safeDeviceName}`,
        html: `
          <h1>Package Delivered!</h1>
          <p>Your parcel has been delivered to <strong>${safeDeviceName}</strong>.</p>
          <p>The door has been securely closed and locked.</p>
        `,
      });
      console.log(`📧 Delivery notification sent to ${to}`);
    } catch (error) {
      console.error("📧 Failed to send email:", error);
    }
  }
}

export const emailService = new EmailService();
