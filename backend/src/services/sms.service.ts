import { config } from "../config.js";

export class SMSService {
  private apiKey: string;
  private templateId: string;
  private isDemoMode: boolean;

  constructor() {
    this.apiKey = config.startMessagingApiKey;
    this.templateId = config.otpTemplateId;
    this.isDemoMode = config.demoMode;
  }

  /**
   * Cleans and validates a 10-digit Indian phone number
   */
  normalizePhone(input: string): string | null {
    if (!input) return null;
    // Strip non-digits
    let cleaned = input.replace(/\D/g, "");
    // If starts with 91 and has 12 digits, strip 91
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.slice(2);
    }
    // If starts with 0 and has 11 digits, strip 0
    if (cleaned.length === 11 && cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    // Must be 10 digits and start with 6, 7, 8, or 9
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  /**
   * Mask phone for logging (e.g. "9876543210" -> "987654****")
   */
  maskPhone(phone: string): string {
    if (phone.length <= 4) return "****";
    return phone.slice(0, -4) + "****";
  }

  /**
   * Sends OTP via StartMessaging API (or simulates in demo mode)
   */
  async sendOtp(phone: string, otp: string): Promise<{ success: boolean; messageId?: string; isDemo?: boolean }> {
    const cleanPhone = this.normalizePhone(phone);
    if (!cleanPhone) {
      throw new Error("Invalid phone number format. Must be a 10-digit Indian mobile number.");
    }

    // Demo mode bypass: only when DEMO_MODE=true is explicitly configured in .env
    if (this.isDemoMode) {
      console.log(`[SMS DEMO] Simulated SMS dispatch for ${this.maskPhone(cleanPhone)}. DEMO OTP: 123456`);
      return { success: true, messageId: "demo_msg_" + Date.now(), isDemo: true };
    }

    const payload = {
      phoneNumber: `+91${cleanPhone}`,
      templateId: this.templateId,
      variables: {
        otp,
        appName: "Secure Box",
      },
    };

    console.log(`[SMS DISPATCH] Sending OTP to ${this.maskPhone(cleanPhone)} via StartMessaging...`);

    try {
      const response = await fetch("https://api.startmessaging.com/otp/send", {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error(`[SMS ERROR] StartMessaging API error (${response.status}):`, data);
        if (response.status === 401) {
          throw new Error("SMS configuration error: Invalid StartMessaging API Key");
        } else if (response.status === 402) {
          throw new Error("SMS gateway error: Insufficient balance for SMS");
        } else if (response.status === 429) {
          throw new Error("SMS rate limit exceeded. Please try again later.");
        }
        throw new Error(data?.message || "Failed to send OTP via SMS provider");
      }

      console.log(`[SMS OK] OTP dispatched to ${this.maskPhone(cleanPhone)}. MessageId: ${data.messageId || "N/A"}`);
      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      console.error("[SMS ERROR] SMSService sendOtp exception:", err.message);
      throw err;
    }
  }
}

export const smsService = new SMSService();
