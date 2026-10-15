import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { User } from "../models/User.model.js";
import { SlotRequest } from "../models/SlotRequest.model.js";
import { SystemConfig } from "../models/SystemConfig.model.js";
import { wsService } from "../services/websocket.service.js";

// Re-export invite code generation and join handlers from decomposed module
export * from "./deviceInvite.controller.js";

function isAuthorizedUser(device: any, userId: string): boolean {
  const isOwner = device.ownerId?.toString() === userId || device.ownerId?._id?.toString() === userId;
  const isCoOwner = device.coOwners?.some((cId: any) => {
    const idStr = cId?.toString() === "[object Object]" ? cId?._id?.toString() : cId?.toString();
    return idStr === userId;
  });
  return Boolean(isOwner || isCoOwner);
}

async function findDeviceByIdOrDeviceId(id: string) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const dev = await Device.findById(id);
    if (dev) return dev;
  }
  return await Device.findOne({ deviceId: id.trim().toUpperCase() });
}

// 1. Add Co-Owner manually by email
export async function addCoOwner(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };
  const { email } = request.body as { email?: string };

  if (!email) {
    return reply.status(400).send({ error: "email is required" });
  }

  const device = await findDeviceByIdOrDeviceId(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (device.ownerId.toString() !== user.id) {
    return reply.status(403).send({ error: "Only the primary owner can add co-owners" });
  }

  const maxAllowed = device.allowedSlots || 2;
  const currentOccupied = 1 + (device.coOwners ? device.coOwners.length : 0);

  if (currentOccupied >= maxAllowed) {
    return reply.status(403).send({
      error: `Device slot limit reached (${currentOccupied}/${maxAllowed}). Contact admin to unlock additional slots.`,
      allowedSlots: maxAllowed,
      occupiedSlots: currentOccupied,
      totalCapacity: 5,
    });
  }

  const cleanEmail = email.toLowerCase().trim();
  const targetUser = await User.findOne({ email: cleanEmail });
  if (!targetUser) {
    return reply.status(404).send({ error: `User with email '${email}' was not found. They must sign up first.` });
  }

  if (targetUser._id.toString() === user.id) {
    return reply.status(400).send({ error: "You are already the primary owner of this device" });
  }

  if (device.coOwners.some((cId) => cId.toString() === targetUser._id.toString())) {
    return reply.status(409).send({ error: "This user is already an authorized co-owner" });
  }

  device.coOwners.push(targetUser._id as mongoose.Types.ObjectId);
  await device.save();

  await Log.create({
    deviceId: device._id,
    action: "co_owner_added",
    metadata: {
      addedBy: user.id,
      coOwnerId: targetUser._id,
      coOwnerEmail: targetUser.email,
      userName: targetUser.name || targetUser.email,
      userRole: "Co-Owner",
    },
  });

  return reply.send({
    success: true,
    message: `Co-owner ${targetUser.email} added successfully (Slot ${currentOccupied + 1}/${maxAllowed})`,
    coOwners: device.coOwners,
    allowedSlots: maxAllowed,
  });
}

// 2. Remove Co-Owner
export async function removeCoOwner(request: FastifyRequest, reply: FastifyReply) {
  const { id, userId } = request.params as { id: string; userId: string };
  const user = request.user as { id: string };

  const device = await findDeviceByIdOrDeviceId(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (device.ownerId.toString() !== user.id) {
    return reply.status(403).send({ error: "Only the primary owner can remove co-owners" });
  }

  device.coOwners = device.coOwners.filter((cId) => cId.toString() !== userId);
  await device.save();

  const removedUser = await User.findById(userId);
  await Log.create({
    deviceId: device._id,
    action: "co_owner_removed",
    metadata: {
      removedBy: user.id,
      removedUserId: userId,
      userName: removedUser?.name || removedUser?.email || "Co-Owner",
      userRole: "Co-Owner",
    },
  });

  return reply.send({
    success: true,
    message: "Co-owner removed successfully",
    coOwners: device.coOwners,
  });
}

// 3. Get Slot Summary
export async function getDeviceSlots(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };

  const query = mongoose.Types.ObjectId.isValid(id)
    ? Device.findById(id)
    : Device.findOne({ deviceId: id.trim().toUpperCase() });

  const device = await query
    .populate("ownerId", "email name phone")
    .populate("coOwners", "email name phone");

  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (!isAuthorizedUser(device, user.id)) {
    return reply.status(403).send({ error: "Not authorized to view device slots" });
  }

  const allowedSlots = device.allowedSlots || 2;
  const usedSlots = 1 + device.coOwners.length;
  const lockedSlots = 5 - allowedSlots;

  const nicknamesObj: Record<string, string> = {};
  if (device.coOwnerNicknames) {
    if (device.coOwnerNicknames instanceof Map) {
      device.coOwnerNicknames.forEach((val, key) => {
        nicknamesObj[key] = val;
      });
    } else {
      Object.assign(nicknamesObj, device.coOwnerNicknames);
    }
  }

  const isOwner = device.ownerId._id?.toString() === user.id || device.ownerId.toString() === user.id;

  return reply.send({
    deviceId: device.deviceId,
    name: device.name,
    totalCapacity: 5,
    allowedSlots,
    lockedSlots,
    usedSlots,
    availableSlots: Math.max(0, allowedSlots - usedSlots),
    primaryOwner: device.ownerId,
    coOwners: device.coOwners,
    coOwnerNicknames: nicknamesObj,
    isOwner,
  });
}

// 4. Rename Co-Owner Alias
export async function renameCoOwner(request: FastifyRequest, reply: FastifyReply) {
  const { id, userId } = request.params as { id: string; userId: string };
  const user = request.user as { id: string };
  const { nickname } = (request.body as { nickname?: string }) || {};

  const device = await findDeviceByIdOrDeviceId(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (device.ownerId.toString() !== user.id) {
    return reply.status(403).send({ error: "Only the primary owner can rename co-owners" });
  }

  if (!device.coOwnerNicknames) {
    device.coOwnerNicknames = new Map();
  }

  const cleanNick = (nickname || "").trim();
  if (cleanNick) {
    device.coOwnerNicknames.set(userId, cleanNick);
  } else {
    device.coOwnerNicknames.delete(userId);
  }

  device.markModified("coOwnerNicknames");
  await device.save();

  return reply.send({
    success: true,
    message: "Co-owner renamed successfully",
    userId,
    nickname: cleanNick,
  });
}

// 5. Request Slot Upgrade (User sends request to Admin to unlock all 3 extra slots to 5 total)
export async function requestSlotUpgrade(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };
  const { desiredSlots, notes, plan } = (request.body as { desiredSlots?: number; notes?: string; plan?: "monthly" | "yearly" }) || {};

  const device = await findDeviceByIdOrDeviceId(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (device.ownerId.toString() !== user.id) {
    return reply.status(403).send({ error: "Only the primary owner can request slot upgrades" });
  }

  const dbUser = await User.findById(user.id);
  const targetSlots = 5; // All 3 extra slots are unlocked at once
  const chosenPlan = plan === "monthly" ? "monthly" : "yearly";

  const config = await SystemConfig.findOne({ key: "slot_pricing" });
  const priceAtRequest = config ? (chosenPlan === "monthly" ? config.monthlyPrice : config.yearlyPrice) : (chosenPlan === "monthly" ? 149 : 999);

  // Check if there is already an existing pending request for this device
  let slotReq = await SlotRequest.findOne({
    deviceId: device._id,
    status: "pending",
  });

  if (slotReq) {
    slotReq.plan = chosenPlan;
    slotReq.priceAtRequest = priceAtRequest;
    slotReq.notes = notes || slotReq.notes;
    await slotReq.save();
  } else {
    slotReq = await SlotRequest.create({
      userId: user.id,
      deviceId: device._id,
      deviceStringId: device.deviceId,
      deviceName: device.name,
      customerName: dbUser?.name || "Customer",
      customerPhone: dbUser?.phone || "",
      customerEmail: dbUser?.email || "",
      currentSlots: device.allowedSlots || 2,
      desiredSlots: targetSlots,
      plan: chosenPlan,
      priceAtRequest,
      status: "pending",
      notes: notes || `Requested ${chosenPlan} plan upgrade to 5 slots`,
    });
  }

  await Log.create({
    deviceId: device._id,
    action: "slot_upgrade_requested",
    metadata: {
      requestId: slotReq._id,
      requestedBy: user.id,
      userName: dbUser?.name || dbUser?.email || "User",
      userPhone: dbUser?.phone || "",
      userEmail: dbUser?.email || "",
      deviceId: device.deviceId,
      deviceName: device.name,
      currentSlots: device.allowedSlots || 2,
      desiredSlots: targetSlots,
      plan: chosenPlan,
      price: priceAtRequest,
      notes: notes || "Requested via mobile app",
    },
  });

  // Broadcast instant alert to Admin Dashboard
  wsService.broadcastToAll({
    type: "NEW_SLOT_UPGRADE_REQUEST",
    requestId: slotReq._id,
    customerName: slotReq.customerName,
    customerPhone: slotReq.customerPhone,
    deviceId: device.deviceId,
    deviceName: device.name,
    plan: chosenPlan,
    price: priceAtRequest,
  });

  return reply.send({
    success: true,
    message: `Upgrade application submitted! Admin will contact you at ${dbUser?.phone || "your phone"} to activate your extra slots.`,
    currentSlots: device.allowedSlots || 2,
    desiredSlots: targetSlots,
    request: slotReq,
  });
}
