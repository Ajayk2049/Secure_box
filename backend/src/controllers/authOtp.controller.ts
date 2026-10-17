import { FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { User } from "../models/User.model.js";
import { Otp } from "../models/Otp.model.js";
import { LockerRequest } from "../models/LockerRequest.model.js";
import { smsService } from "../services/sms.service.js";
import { config } from "../config.js";
import { createLockerOrderRequest, redeemInviteCodeOnSignup } from "../services/registration.service.js";
import { TokenService } from "../services/token.service.js";
import { hashPassword } from "../utils/password.js";

// 1. Send OTP with Smart Pre-Check
export async function sendOtp(request: FastifyRequest, reply: FastifyReply) {
  const { phone, type = "register" } = (request.body as { phone?: string; type?: "register" | "reset" }) || {};

  if (!phone) {
    return reply.status(400).send({ error: "Mobile number is required" });
  }

  const cleanPhone = smsService.normalizePhone(phone);
  if (!cleanPhone) {
    return reply.status(400).send({
      error: "Invalid phone number. Must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
    });
  }

  const userQuery = {
    $or: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }],
  };
  const existingUser = await User.findOne(userQuery);

  if (type === "register" && existingUser) {
    return reply.status(409).send({
      exists: true,
      error: "An account with this mobile number already exists. Please log in instead.",
    });
  }
  if (type === "reset" && !existingUser) {
    return reply.status(404).send({
      exists: false,
      error: "No account found registered with this mobile number. Please check the number or sign up.",
    });
  }

  // Check existing OTP records for rate limiting (cooldown & sliding window limits)
  const existingOtps = await Otp.find({ phone: cleanPhone }).sort({ createdAt: -1 });
  const allTimestamps: Date[] = [];
  for (const rec of existingOtps) {
    if (rec.requestTimestamps && rec.requestTimestamps.length > 0) {
      allTimestamps.push(...rec.requestTimestamps);
    } else if (rec.createdAt) {
      allTimestamps.push(rec.createdAt);
    }
  }

  const now = Date.now();
  // 1. Cooldown check (60s for both registration and reset per Rule 22.11)
  const cooldownDuration = 60 * 1000;
  const lastRequestTime = allTimestamps.length > 0 ? Math.max(...allTimestamps.map((t) => new Date(t).getTime())) : 0;
  if (lastRequestTime && now - lastRequestTime < cooldownDuration) {
    const waitSeconds = Math.ceil((cooldownDuration - (now - lastRequestTime)) / 1000);
    return reply.status(429).send({
      error: `Please wait ${waitSeconds}s before requesting another OTP.`,
      cooldownRemaining: waitSeconds,
    });
  }

  // 2. Max 3 requests in the last 60 seconds check
  const oneMinuteAgo = now - 60 * 1000;
  const recentRequests = allTimestamps.filter((t) => new Date(t).getTime() > oneMinuteAgo);
  if (recentRequests.length >= 3) {
    const oldestInWindow = Math.min(...recentRequests.map((t) => new Date(t).getTime()));
    const waitSeconds = Math.ceil((60 * 1000 - (now - oldestInWindow)) / 1000);
    return reply.status(429).send({
      error: `Too many OTP requests. Maximum 3 requests per minute. Please try again in ${waitSeconds}s.`,
      cooldownRemaining: waitSeconds,
    });
  }

  // 3. For password reset: Max 5 requests per 15 minutes to prevent OTP bombardment
  if (type === "reset") {
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    const windowRequests = allTimestamps.filter((t) => new Date(t).getTime() > fifteenMinutesAgo);
    if (windowRequests.length >= 5) {
      const oldestInWindow = Math.min(...windowRequests.map((t) => new Date(t).getTime()));
      const waitSeconds = Math.ceil((15 * 60 * 1000 - (now - oldestInWindow)) / 1000);
      return reply.status(429).send({
        error: `Security limit reached for password recovery. Maximum 5 OTP requests per 15 minutes. Please try again later.`,
        cooldownRemaining: waitSeconds,
      });
    }
  }

  // Generate cryptographically random 6-digit OTP (or fixed 123456 in demo mode)
  const otp = config.demoMode ? "123456" : crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Hash OTP using SHA-256 so plaintext OTP is never persisted in database
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  // Keep recent timestamps within the last 15 minutes to maintain sliding rate window
  const slidingTimestamps = [
    ...allTimestamps.filter((t) => new Date(t).getTime() > now - 15 * 60 * 1000),
    new Date(),
  ];

  await Otp.deleteMany({ phone: cleanPhone, verified: false });

  await Otp.create({
    phone: cleanPhone,
    otp: hashedOtp,
    expiresAt,
    attempts: 0,
    verified: false,
    requestTimestamps: slidingTimestamps,
  });

  await smsService.sendOtp(cleanPhone, otp);

  return reply.send({
    success: true,
    message: config.demoMode
      ? "Demo Mode: OTP is 123456"
      : "OTP sent successfully to your mobile number",
    exists: false,
    demoOtp: config.demoMode ? "123456" : undefined,
    data: {
      phone: cleanPhone,
      expiresIn: 600,
    },
  });
}

// 2. Check If Phone Exists
export async function checkPhone(request: FastifyRequest, reply: FastifyReply) {
  const { phone } = (request.body as { phone?: string }) || {};

  if (!phone) {
    return reply.status(400).send({ error: "Mobile number is required" });
  }

  const cleanPhone = smsService.normalizePhone(phone);
  if (!cleanPhone) {
    return reply.status(400).send({
      error: "Invalid phone number. Must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
    });
  }

  const existingUser = await User.findOne({
    $or: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }],
  });
  return reply.send({
    exists: Boolean(existingUser),
    phone: cleanPhone,
    message: existingUser
      ? "An account with this mobile number already exists. Please sign in."
      : "Mobile number is available",
  });
}

// 2b. Check If Email Exists
export async function checkEmail(request: FastifyRequest, reply: FastifyReply) {
  const { email } = (request.body as { email?: string }) || {};

  if (!email) {
    return reply.status(400).send({ error: "Email address is required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: cleanEmail });

  return reply.send({
    exists: Boolean(existingUser),
    email: cleanEmail,
    message: existingUser
      ? "An account with this email address already exists. Please sign in."
      : "Email address is available",
  });
}

// 3. Register Account with OTP
export async function registerWithOtp(request: FastifyRequest, reply: FastifyReply) {
  const { phone, otp, password, email, name, inviteCode, address, pincode, units } = request.body as {
    phone?: string;
    otp?: string;
    password?: string;
    email?: string;
    name?: string;
    inviteCode?: string;
    address?: string;
    pincode?: string;
    units?: number;
  };

  if (!phone || !otp || !password) {
    return reply.status(400).send({ error: "phone, otp, and password are required" });
  }

  if (password.length < 6 || password.length > 12) {
    return reply.status(400).send({ error: "Password must be between 6 and 12 characters long" });
  }

  const cleanPhone = smsService.normalizePhone(phone);
  if (!cleanPhone) {
    return reply.status(400).send({ error: "Invalid mobile number format" });
  }

  const existingUser = await User.findOne({ phone: cleanPhone });
  if (existingUser) {
    return reply.status(409).send({
      exists: true,
      error: "An account with this mobile number already exists. Please log in instead.",
    });
  }

  const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;
  if (cleanEmail) {
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return reply.status(409).send({
        exists: true,
        error: "An account with this email address already exists. Please log in or use a different email.",
      });
    }
  }

  const isDemoBypass = config.demoMode && (otp.trim() === "123456" || otp.trim() === "000000");

  const otpRecord = await Otp.findOne({
    phone: cleanPhone,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (otpRecord) {
    const candBuf = Buffer.from(crypto.createHash("sha256").update(otp.trim()).digest("hex"), "utf8");
    const storedBuf = Buffer.from(otpRecord.otp, "utf8");
    const isHashMatch = candBuf.length === storedBuf.length && crypto.timingSafeEqual(candBuf, storedBuf);

    if (!isHashMatch && !isDemoBypass) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= 3) {
        await Otp.deleteOne({ _id: otpRecord._id });
        return reply.status(400).send({ error: "Maximum incorrect OTP attempts exceeded. Please request a new OTP." });
      }
      await otpRecord.save();
      return reply.status(400).send({ error: "Incorrect OTP. Please try again." });
    }

    otpRecord.verified = true;
    await Otp.deleteOne({ _id: otpRecord._id });
  } else if (!isDemoBypass) {
    return reply.status(400).send({ error: "Invalid or expired OTP. Please request a new one." });
  }

  const isPlacingOrder = Boolean(address && address.trim());

  // Hash with Argon2id per rules.md Section 22.1
  const hashedPassword = await hashPassword(password);

  const userData: any = {
    phone: cleanPhone,
    name: name ? name.trim() : undefined,
    password: hashedPassword,
    role: "user",
    isPhoneVerified: true,
  };
  if (cleanEmail) userData.email = cleanEmail;
  if (isPlacingOrder) {
    userData.address = address!.trim();
    if (pincode && pincode.trim()) userData.pincode = pincode.trim();
    userData.units = units ? Number(units) || 1 : 1;
    userData.orderStatus = "pending";
  } else {
    userData.units = 0;
  }

  let newUser: any;
  try {
    newUser = await User.create(userData);
  } catch (err: any) {
    if (err.code === 11000) {
      if (err.keyPattern?.email || err.message?.includes("email_1")) {
        return reply.status(409).send({
          exists: true,
          error: "An account with this email address already exists. Please log in or use a different email.",
        });
      }
      return reply.status(409).send({
        exists: true,
        error: "An account with this mobile number already exists. Please log in instead.",
      });
    }
    throw err;
  }

  // Only create a Locker Delivery Request if user explicitly ordered with address
  if (isPlacingOrder) {
    await createLockerOrderRequest({
      userId: newUser._id,
      name: newUser.name,
      phone: newUser.phone,
      email: newUser.email,
      address: newUser.address,
      pincode: newUser.pincode,
      units: newUser.units,
    });
  }

  // Handle optional Join Code
  let joinedDevice = null;
  if (inviteCode) {
    joinedDevice = await redeemInviteCodeOnSignup(inviteCode, newUser._id);
  }

  const token = request.server.jwt.sign({
    id: newUser._id,
    phone: newUser.phone,
    email: newUser.email,
    role: newUser.role,
  });

  const refreshToken = await TokenService.createRefreshToken(newUser._id);

  return reply.status(201).send({
    success: true,
    message: "Account created successfully",
    user: {
      id: newUser._id,
      phone: newUser.phone,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      address: newUser.address,
      pincode: newUser.pincode,
      units: newUser.units,
      orderStatus: newUser.orderStatus,
      assignedDevices: newUser.assignedDevices || [],
    },
    token,
    refreshToken,
    joinedDevice,
  });
}

