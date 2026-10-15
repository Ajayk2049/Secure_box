import crypto from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { User } from "../models/User.model.js";

async function findDeviceByIdOrDeviceId(id: string) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const dev = await Device.findById(id);
    if (dev) return dev;
  }
  return await Device.findOne({ deviceId: id.trim().toUpperCase() });
}

// 1. Create Co-Owner Join/Invite Code
export async function createInviteCode(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };

  const device = await findDeviceByIdOrDeviceId(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (device.ownerId.toString() !== user.id) {
    return reply.status(403).send({ error: "Only the primary owner can generate invite codes" });
  }

  const maxAllowed = device.allowedSlots || 2;
  const currentOccupied = 1 + (device.coOwners ? device.coOwners.length : 0);

  if (currentOccupied >= maxAllowed) {
    return reply.status(403).send({
      error: `All ${maxAllowed} slots are occupied. Upgrade slots via admin to invite more users.`,
    });
  }

  // If device already has an active, valid invite code (valid for > 60s), reuse it!
  if (device.inviteCode && device.inviteExpiresAt && device.inviteExpiresAt > new Date(Date.now() + 60 * 1000)) {
    return reply.send({
      success: true,
      inviteCode: device.inviteCode,
      expiresAt: device.inviteExpiresAt,
      expiresInSeconds: Math.floor((device.inviteExpiresAt.getTime() - Date.now()) / 1000),
      message: `Share code ${device.inviteCode} with your co-owner. Valid for 24 hours.`,
    });
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let randomSuffix = "";
  for (let i = 0; i < 6; i++) {
    randomSuffix += chars[bytes[i] % chars.length];
  }
  const inviteCode = `SBX-${randomSuffix}`;
  const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  device.inviteCode = inviteCode;
  device.inviteExpiresAt = inviteExpiresAt;
  await device.save();

  return reply.send({
    success: true,
    inviteCode,
    expiresAt: inviteExpiresAt,
    expiresInSeconds: 86400,
    message: `Share code ${inviteCode} with your co-owner. Valid for 24 hours.`,
  });
}

// 2. Cancel Invite Code
export async function cancelInviteCode(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };

  const device = await findDeviceByIdOrDeviceId(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (device.ownerId.toString() !== user.id) {
    return reply.status(403).send({ error: "Only the primary owner can revoke invite codes" });
  }

  device.inviteCode = undefined;
  device.inviteExpiresAt = undefined;
  await device.save();

  return reply.send({ success: true, message: "Invite code successfully revoked" });
}

// 3. Join Device via Invite Code
export async function joinDevice(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { id: string };
  const { inviteCode } = request.body as { inviteCode?: string };

  if (!inviteCode) {
    return reply.status(400).send({ error: "inviteCode is required" });
  }

  const cleanCode = inviteCode.trim().toUpperCase();
  const rawAlphanumeric = cleanCode.replace(/[^A-Z0-9]/g, "");
  const normalizedWithPrefix = rawAlphanumeric.startsWith("SBX")
    ? `SBX-${rawAlphanumeric.substring(3)}`
    : `SBX-${rawAlphanumeric}`;

  const userObjectId = new mongoose.Types.ObjectId(user.id);
  const codeMatches = [cleanCode, normalizedWithPrefix, rawAlphanumeric];

  // Atomic conditional update:
  // 1. Matches active, unexpired inviteCode
  // 2. Prevents primary owner from adding themselves
  // 3. Prevents duplicate co-owner addition
  // 4. Guarantees capacity limit atomically: size(coOwners) < allowedSlots - 1
  const updatedDevice = await Device.findOneAndUpdate(
    {
      inviteCode: { $in: codeMatches },
      inviteExpiresAt: { $gt: new Date() },
      ownerId: { $ne: userObjectId },
      coOwners: { $ne: userObjectId },
      $expr: {
        $lt: [
          { $size: { $ifNull: ["$coOwners", []] } },
          { $subtract: [{ $ifNull: ["$allowedSlots", 2] }, 1] },
        ],
      },
    },
    {
      $push: { coOwners: userObjectId },
      $unset: { inviteCode: "", inviteExpiresAt: "" },
    },
    { new: true }
  );

  if (!updatedDevice) {
    // Diagnose exact rejection reason for clear client feedback
    const existingCodeDevice = await Device.findOne({
      inviteCode: { $in: codeMatches },
      inviteExpiresAt: { $gt: new Date() },
    });

    if (!existingCodeDevice) {
      return reply.status(404).send({ error: "Invalid or expired invite code. Please ask the owner for a new code." });
    }
    if (existingCodeDevice.ownerId.toString() === user.id) {
      return reply.status(400).send({ error: "You are already the primary owner of this device" });
    }
    if (existingCodeDevice.coOwners.some((cId) => cId.toString() === user.id)) {
      return reply.status(409).send({ error: "You are already a co-owner of this device" });
    }
    const maxAllowed = existingCodeDevice.allowedSlots || 2;
    const currentOccupied = 1 + (existingCodeDevice.coOwners ? existingCodeDevice.coOwners.length : 0);
    if (currentOccupied >= maxAllowed) {
      return reply.status(403).send({ error: "This device has already reached its user slot capacity" });
    }
    return reply.status(400).send({ error: "Could not join device. Please try again." });
  }

  // Record on user model
  await User.findByIdAndUpdate(user.id, {
    $addToSet: { assignedDevices: updatedDevice.deviceId },
  });

  const dbUser = await User.findById(user.id);
  const joinerName = dbUser?.name || dbUser?.email || "Co-Owner";

  await Log.create({
    deviceId: updatedDevice._id,
    action: "co_owner_added",
    metadata: {
      coOwnerId: user.id,
      userName: joinerName,
      userRole: "Co-Owner",
      method: "join_code",
    },
  });

  return reply.send({
    success: true,
    message: `Successfully joined '${updatedDevice.name}' as a co-owner!`,
    device: {
      id: updatedDevice._id,
      deviceId: updatedDevice.deviceId,
      name: updatedDevice.name,
      doorState: updatedDevice.doorState,
      online: updatedDevice.online,
      isOwner: false,
      userRole: "Co-Owner",
    },
  });
}
