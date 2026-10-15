import mongoose from "mongoose";
import { hashPassword } from "./utils/password.js";
import { config } from "./config.js";
import { User } from "./models/User.model.js";
import { Device } from "./models/Device.model.js";
import { Log } from "./models/Log.model.js";
import { Otp } from "./models/Otp.model.js";

async function seedAdmin() {
  console.log("[PURGE] Connecting to MongoDB to purge dummy data and seed Admin...");
  await mongoose.connect(config.mongodbUri);
  console.log("[OK] MongoDB connected to:", config.mongodbUri.replace(/\/\/.*@/, "//***@"));

  // 1. Verify required environment variables (No hardcoded credentials allowed)
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("[ERROR] Both ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must be defined in your environment (.env file).");
    process.exit(1);
  }

  // 2. Check if an admin account already exists in the database
  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log(`[INFO] Admin account already exists in database: ${existingAdmin.email} (id: ${existingAdmin._id}). Skipping creation.`);
    await mongoose.disconnect();
    console.log("[DISCONNECT] MongoDB disconnected cleanly.");
    process.exit(0);
  }

  console.log("[SEED] No admin account found. Creating platform administrator...");
  const hashedAdminPassword = await hashPassword(adminPassword);
  const admin = await User.create({
    email: adminEmail,
    password: hashedAdminPassword,
    name: "Platform Admin",
    role: "admin",
    isPhoneVerified: true,
    isDemo: false,
  });

  console.log("\n==================================================");
  console.log("Platform Admin Created Successfully!");
  console.log("==================================================");
  console.log(`Admin Email:     ${admin.email}`);
  console.log(`Role:            ${admin.role}`);
  console.log(`User ID (_id):   ${admin._id}`);
  console.log("==================================================\n");

  await mongoose.disconnect();
  console.log("[DISCONNECT] MongoDB disconnected cleanly.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("[ERROR] seedAdmin failed:", err);
  process.exit(1);
});
