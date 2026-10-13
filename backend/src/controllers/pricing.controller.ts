import { FastifyRequest, FastifyReply } from "fastify";
import { SystemConfig } from "../models/SystemConfig.model.js";
import { SlotRequest } from "../models/SlotRequest.model.js";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "../services/websocket.service.js";

// Ensure default pricing exists
async function getOrCreateSlotPricing() {
  let config = await SystemConfig.findOne({ key: "slot_pricing" });
  if (!config) {
    config = await SystemConfig.create({
      key: "slot_pricing",
      monthlyPrice: 149,
      yearlyPrice: 999,
      currency: "INR",
      extraSlotsCount: 3,
      description: "Unlock all 3 extra slots at once (Total 5 slots capacity)",
    });
  }
  return config;
}

// 1. Get slot pricing (Public / Mobile App / Admin)
export async function getSlotPricing(request: FastifyRequest, reply: FastifyReply) {
  const config = await getOrCreateSlotPricing();
  const yearlyMonthlyEquivalent = Math.round(config.yearlyPrice / 12);
  const fullMonthlyForYear = config.monthlyPrice * 12;
  const savingsPercent = fullMonthlyForYear > config.yearlyPrice
    ? Math.round(((fullMonthlyForYear - config.yearlyPrice) / fullMonthlyForYear) * 100)
    : 0;

  return reply.send({
    success: true,
    currency: config.currency,
    monthlyPrice: config.monthlyPrice,
    yearlyPrice: config.yearlyPrice,
    extraSlotsCount: config.extraSlotsCount || 3,
    totalCapacity: 5,
    savingsPercent,
    yearlyMonthlyEquivalent,
    description: config.description,
  });
}

// 2. Update slot pricing (Admin Only)
export async function updateSlotPricing(request: FastifyRequest, reply: FastifyReply) {
  const { monthlyPrice, yearlyPrice, currency } = (request.body as {
    monthlyPrice?: number;
    yearlyPrice?: number;
    currency?: string;
  }) || {};

  if (typeof monthlyPrice !== "number" || typeof yearlyPrice !== "number") {
    return reply.status(400).send({ error: "monthlyPrice and yearlyPrice must be numbers" });
  }

  if (monthlyPrice <= 0 || yearlyPrice <= 0) {
    return reply.status(400).send({ error: "Prices must be greater than 0" });
  }

  const config = await getOrCreateSlotPricing();
  config.monthlyPrice = monthlyPrice;
  config.yearlyPrice = yearlyPrice;
  if (currency) config.currency = currency.toUpperCase().trim();
  await config.save();

  // Broadcast price update to all connected clients
  wsService.broadcastToAll({
    type: "PRICING_UPDATED",
    monthlyPrice: config.monthlyPrice,
    yearlyPrice: config.yearlyPrice,
  });

  return reply.send({
    success: true,
    message: "Slot pricing updated successfully",
    pricing: {
      monthlyPrice: config.monthlyPrice,
      yearlyPrice: config.yearlyPrice,
      currency: config.currency,
    },
  });
}

// 3. Get all slot upgrade requests (Admin Only)
export async function getAllSlotRequests(request: FastifyRequest, reply: FastifyReply) {
  const requests = await SlotRequest.find()
    .populate("userId", "name phone email")
    .populate("deviceId", "deviceId name allowedSlots coOwners")
    .sort({ createdAt: -1 });

  return reply.send({
    success: true,
    requests,
  });
}

// 4. Approve slot upgrade request (Admin Only - Unlocks all 3 extra slots to 5 total)
export async function approveSlotRequest(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { adminNotes } = (request.body as { adminNotes?: string }) || {};
  const adminUser = request.user as { id: string };

  const slotReq = await SlotRequest.findById(id);
  if (!slotReq) {
    return reply.status(404).send({ error: "Slot upgrade request not found" });
  }

  if (slotReq.status === "approved") {
    return reply.status(400).send({ error: "This request is already approved" });
  }

  const device = await Device.findById(slotReq.deviceId);
  if (!device) {
    return reply.status(404).send({ error: "Associated locker device not found" });
  }

  // Unlock all 3 extra slots to 5 total at once
  const prevSlots = device.allowedSlots || 2;
  device.allowedSlots = 5;
  await device.save();

  slotReq.status = "approved";
  slotReq.desiredSlots = 5;
  if (adminNotes) slotReq.adminNotes = adminNotes.trim();
  slotReq.processedBy = adminUser?.id as any;
  slotReq.processedAt = new Date();
  await slotReq.save();

  // Log the action
  await Log.create({
    deviceId: device._id,
    action: "admin_slot_update",
    metadata: {
      action: "slot_upgrade_approved",
      requestId: slotReq._id,
      previousAllowedSlots: prevSlots,
      newAllowedSlots: 5,
      customerName: slotReq.customerName,
      customerPhone: slotReq.customerPhone,
      plan: slotReq.plan,
      approvedBy: adminUser.id,
    },
  });

  // Broadcast real-time status update to locker owners & app
  const statusMsg = {
    type: "DEVICE_STATUS",
    deviceId: device.deviceId,
    allowedSlots: 5,
    message: "Congratulations! All 5 locker member slots are now unlocked.",
  };
  wsService.broadcastToAll(statusMsg);

  return reply.send({
    success: true,
    message: `All 3 extra slots unlocked! Device ${device.deviceId} now has 5 slots capacity.`,
    device: {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      allowedSlots: 5,
      totalCapacity: 5,
    },
    request: slotReq,
  });
}

// 5. Reject slot upgrade request (Admin Only)
export async function rejectSlotRequest(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { adminNotes } = (request.body as { adminNotes?: string }) || {};
  const adminUser = request.user as { id: string };

  const slotReq = await SlotRequest.findById(id);
  if (!slotReq) {
    return reply.status(404).send({ error: "Slot upgrade request not found" });
  }

  slotReq.status = "rejected";
  if (adminNotes) slotReq.adminNotes = adminNotes.trim();
  slotReq.processedBy = adminUser?.id as any;
  slotReq.processedAt = new Date();
  await slotReq.save();

  return reply.send({
    success: true,
    message: "Slot upgrade request has been rejected",
    request: slotReq,
  });
}

// 6. Revoke slot upgrade (Reset locker back to 2 base slots) (Admin Only)
export async function revokeSlotRequest(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { adminNotes } = (request.body as { adminNotes?: string }) || {};
  const adminUser = request.user as { id: string };

  const slotReq = await SlotRequest.findById(id);
  if (!slotReq) {
    return reply.status(404).send({ error: "Slot upgrade request not found" });
  }

  const device = await Device.findById(slotReq.deviceId);
  if (!device) {
    return reply.status(404).send({ error: "Associated locker device not found" });
  }

  // Reset back to base 2 slots
  const prevSlots = device.allowedSlots || 5;
  device.allowedSlots = 2;
  await device.save();

  slotReq.status = "rejected";
  slotReq.adminNotes = adminNotes ? adminNotes.trim() : "Slots revoked back to base 2 slots by admin";
  slotReq.processedBy = adminUser?.id as any;
  slotReq.processedAt = new Date();
  await slotReq.save();

  // Log the revocation
  await Log.create({
    deviceId: device._id,
    action: "admin_slot_update",
    metadata: {
      action: "slot_upgrade_revoked",
      requestId: slotReq._id,
      previousAllowedSlots: prevSlots,
      newAllowedSlots: 2,
      customerName: slotReq.customerName,
      customerPhone: slotReq.customerPhone,
      revokedBy: adminUser.id,
    },
  });

  // Broadcast real-time status update to locker owners & app
  const statusMsg = {
    type: "DEVICE_STATUS",
    deviceId: device.deviceId,
    allowedSlots: 2,
    message: "Locker member slots reset to base 2 slots.",
  };
  wsService.broadcastToAll(statusMsg);

  return reply.send({
    success: true,
    message: `Locker ${device.deviceId} has been revoked back to 2 base slots.`,
    device: {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      allowedSlots: 2,
      totalCapacity: 5,
    },
    request: slotReq,
  });
}

