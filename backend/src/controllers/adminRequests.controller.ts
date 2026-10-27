import { FastifyRequest, FastifyReply } from "fastify";
import { LockerRequest } from "../models/LockerRequest.model.js";
import { User } from "../models/User.model.js";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { deviceStatusService } from "../services/deviceStatus.service.js";
import { generateSecureDeviceId, generateDeviceKey, hashDeviceKey } from "../utils/crypto.js";
export { generateDeviceKey, generateSecureDeviceId };

// 1. Get all locker requests / orders
export async function getAllRequests(request: FastifyRequest, reply: FastifyReply) {
  // Sync fallback: only for customers who actually ordered with an address
  const usersWithOrders = await User.find({
    orderStatus: { $exists: true, $ne: null },
    address: { $exists: true, $ne: "" },
    role: { $ne: "admin" },
  })
    .select("_id name phone email address pincode units orderStatus assignedDevices createdAt")
    .lean();

  if (usersWithOrders.length > 0) {
    const userIds = usersWithOrders.map((u: any) => u._id);
    const existingReqs = await LockerRequest.find({ userId: { $in: userIds } })
      .select("userId")
      .lean();
    const existingUserIdsSet = new Set(existingReqs.map((r: any) => r.userId.toString()));

    const missingRequests = usersWithOrders.filter((u: any) => !existingUserIdsSet.has(u._id.toString()));
    if (missingRequests.length > 0) {
      await LockerRequest.insertMany(
        missingRequests.map((u: any) => ({
          userId: u._id,
          name: u.name || "Customer",
          phone: u.phone,
          email: u.email,
          address: u.address || "Bengaluru",
          pincode: u.pincode || "560001",
          units: u.units || 1,
          status: (u.orderStatus as any) || "pending",
          assignedDeviceIds: u.assignedDevices || [],
          createdAt: u.createdAt || new Date(),
        }))
      );
    }
  }

  const requests = await LockerRequest.find()
    .populate("userId", "name phone email address pincode units orderStatus")
    .sort({ createdAt: -1 })
    .lean();

  // Attach live device heartbeat and online status from Device model (Keys strictly excluded)
  const allAssignedIds = requests.flatMap((r: any) => r.assignedDeviceIds || []);
  const devices = await Device.find({ deviceId: { $in: allAssignedIds } })
    .select("deviceId online lastHeartbeat doorState")
    .lean();

  const deviceMap = new Map(devices.map((d: any) => [d.deviceId, d]));

  const requestsWithStatus = requests.map((req: any) => {
    const obj = { ...req };
    const assignedDevicesInfo = (req.assignedDeviceIds || []).map((id: string) => {
      const d: any = deviceMap.get(id);
      const isOnline = d ? deviceStatusService.resolveDeviceOnline(id, d.online, d.lastHeartbeat) : false;
      return {
        deviceId: id,
        online: isOnline,
        lastHeartbeat: d ? d.lastHeartbeat : null,
        doorState: d ? d.doorState : "closed",
      };
    });

    const isDeviceOnline = assignedDevicesInfo.some((d: any) => d.online);
    const lastHeartbeat = assignedDevicesInfo.find((d: any) => d.lastHeartbeat)?.lastHeartbeat || null;

    return {
      ...obj,
      assignedDevicesInfo,
      isDeviceOnline,
      lastHeartbeat,
    };
  });

  return reply.send({ requests: requestsWithStatus });
}

// 2. Update order lifecycle status (preparing, dispatched, delivered, rejected)
export async function updateRequestStatus(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { status, deviceId, rejectionReason, notes, verificationNotes } = (request.body as {
    status?: "preparing" | "dispatched" | "delivered" | "approved" | "rejected";
    deviceId?: string;
    rejectionReason?: string;
    notes?: string;
    verificationNotes?: string;
  }) || {};

  const validStatuses = ["preparing", "dispatched", "delivered", "approved", "rejected"];
  if (!status || !validStatuses.includes(status)) {
    return reply.status(400).send({ error: `Status must be one of: ${validStatuses.join(", ")}` });
  }

  const lockerReq = await LockerRequest.findById(id);
  if (!lockerReq) {
    return reply.status(404).send({ error: "Locker request not found" });
  }

  const adminId = (request.user as { id: string })?.id;

  // Step 1: Accept & Prepare
  if (status === "preparing" || status === "approved") {
    let cleanDeviceId = deviceId?.trim().toUpperCase() || (lockerReq.assignedDeviceIds && lockerReq.assignedDeviceIds[0]);
    if (!cleanDeviceId) {
      cleanDeviceId = await generateSecureDeviceId();
    }

    // Check if device is already assigned to another customer's order
    const existingReqWithDevice = await LockerRequest.findOne({
      _id: { $ne: lockerReq._id },
      assignedDeviceIds: cleanDeviceId,
    });
    if (existingReqWithDevice) {
      return reply.status(409).send({
        error: `Device "${cleanDeviceId}" is already assigned to ${existingReqWithDevice.name} (${existingReqWithDevice.phone})! Please assign a different unit.`,
      });
    }

    let rawKey = "";
    let device = await Device.findOne({ deviceId: cleanDeviceId }).select("+deviceKeyHash +deviceKey");
    if (device) {
      if (device.ownerId && device.ownerId.toString() !== lockerReq.userId.toString()) {
        return reply.status(409).send({
          error: `Device "${cleanDeviceId}" is already registered to another customer! Please assign an available unit.`,
        });
      }
      device.ownerId = lockerReq.userId;
      if (!device.deviceKeyHash && !device.deviceKey) {
        rawKey = generateDeviceKey();
        device.deviceKeyHash = hashDeviceKey(rawKey);
      }
      await device.save();
    } else {
      rawKey = generateDeviceKey();
      device = await Device.create({
        deviceId: cleanDeviceId,
        name: `${lockerReq.name}'s Secure Box`,
        ownerId: lockerReq.userId,
        coOwners: [],
        allowedSlots: 2,
        doorState: "closed",
        online: true,
        deviceKeyHash: hashDeviceKey(rawKey),
      });
    }

    lockerReq.status = "preparing";
    if (!lockerReq.assignedDeviceIds.includes(cleanDeviceId)) {
      lockerReq.assignedDeviceIds.push(cleanDeviceId);
    }
    if (notes) lockerReq.notes = notes.trim();
    lockerReq.reviewedAt = new Date();
    if (adminId) lockerReq.reviewedBy = adminId as any;
    await lockerReq.save();

    await User.findByIdAndUpdate(lockerReq.userId, {
      orderStatus: "preparing",
      $addToSet: { assignedDevices: cleanDeviceId },
    });

    await Log.create({
      deviceId: device._id,
      action: "order_preparing",
      metadata: {
        requestId: lockerReq._id,
        deviceId: cleanDeviceId,
        customerId: lockerReq.userId,
        approvedBy: adminId,
        notes: lockerReq.notes,
      },
    });

    const devObj = device.toObject();
    delete (devObj as any).deviceKeyHash;
    delete (devObj as any).deviceKey;
    if (rawKey) {
      (devObj as any).deviceKey = rawKey; // Show-once on Prepare step for flashing
    }

    return reply.send({
      success: true,
      message: `Request accepted! Locker ${cleanDeviceId} assigned and in preparation.`,
      request: lockerReq,
      device: devObj,
    });
  }

  // Step 2: Dispatched
  if (status === "dispatched") {
    lockerReq.status = "dispatched";
    lockerReq.dispatchedAt = new Date();
    if (notes) lockerReq.notes = notes.trim();
    await lockerReq.save();
    await User.findByIdAndUpdate(lockerReq.userId, { orderStatus: "dispatched" });
    await Log.create({
      action: "order_dispatched",
      metadata: { requestId: lockerReq._id, customerId: lockerReq.userId, dispatchedBy: adminId, assignedDevices: lockerReq.assignedDeviceIds },
    });
    return reply.send({ success: true, message: `Order for ${lockerReq.name} marked as dispatched.`, request: lockerReq });
  }

  // Step 3: Delivered & Verified Live
  if (status === "delivered") {
    lockerReq.status = "delivered";
    lockerReq.deliveredAt = new Date();
    if (verificationNotes) lockerReq.verificationNotes = verificationNotes.trim();
    if (notes) lockerReq.notes = notes.trim();
    await lockerReq.save();
    await User.findByIdAndUpdate(lockerReq.userId, { orderStatus: "delivered" });
    if (lockerReq.assignedDeviceIds?.length > 0) {
      await Device.updateMany({ deviceId: { $in: lockerReq.assignedDeviceIds } }, { online: true });
    }
    await Log.create({
      action: "order_delivered",
      metadata: { requestId: lockerReq._id, customerId: lockerReq.userId, verifiedBy: adminId, verificationNotes: lockerReq.verificationNotes },
    });
    return reply.send({ success: true, message: `Order for ${lockerReq.name} marked as delivered, installed, and verified live!`, request: lockerReq });
  }

  // Step 4: Rejected
  if (status === "rejected") {
    lockerReq.status = "rejected";
    lockerReq.rejectionReason = rejectionReason?.trim() || "Unable to fulfill request at this address";
    if (notes) lockerReq.notes = notes.trim();
    lockerReq.reviewedAt = new Date();
    if (adminId) lockerReq.reviewedBy = adminId as any;
    await lockerReq.save();
    await User.findByIdAndUpdate(lockerReq.userId, { orderStatus: "rejected" });
    await Log.create({
      action: "order_rejected",
      metadata: { requestId: lockerReq._id, customerId: lockerReq.userId, reason: lockerReq.rejectionReason, rejectedBy: adminId },
    });
    return reply.send({ success: true, message: `Request for ${lockerReq.name} marked as rejected.`, request: lockerReq });
  }
}
