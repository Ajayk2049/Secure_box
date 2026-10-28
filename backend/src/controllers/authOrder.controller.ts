import { FastifyRequest, FastifyReply } from "fastify";
import { User } from "../models/User.model.js";
import { LockerRequest } from "../models/LockerRequest.model.js";
import { createLockerOrderRequest } from "../services/registration.service.js";

// Place Order for Logged-In User
export async function placeOrder(request: FastifyRequest, reply: FastifyReply) {
  const authUser = (request as any).user;
  if (!authUser?.id) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  const { address, pincode, units } = request.body as {
    address?: string;
    pincode?: string;
    units?: number;
  };

  if (!address || !address.trim()) {
    return reply.status(400).send({ error: "Doorstep delivery address is required" });
  }

  const cleanPincode = (pincode || "").trim();
  const orderUnits = units ? Number(units) || 1 : 1;

  const user = await User.findById(authUser.id);
  if (!user) {
    return reply.status(404).send({ error: "User not found" });
  }

  user.address = address.trim();
  if (cleanPincode) user.pincode = cleanPincode;
  const existingRequests = await LockerRequest.find({ userId: user._id, status: { $ne: "rejected" } });
  const priorUnits = existingRequests.reduce((sum: number, r: any) => sum + (r.units || 1), 0);
  const totalUnits = priorUnits + orderUnits;
  user.units = totalUnits;
  user.orderStatus = "pending";
  await user.save();

  const lockerReq = await createLockerOrderRequest({
    userId: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    address: user.address,
    pincode: user.pincode,
    units: orderUnits,
  });

  return reply.status(201).send({
    success: true,
    message: "Order placed successfully! In queue for hub preparation.",
    order: lockerReq,
    user: {
      id: user._id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      role: user.role,
      address: user.address,
      pincode: user.pincode,
      units: user.units,
      orderStatus: user.orderStatus,
      assignedDevices: user.assignedDevices || [],
      notificationPreferences: {
        doorStatus: user.notificationPreferences?.doorStatus ?? false,
        lockerConnectivity: user.notificationPreferences?.lockerConnectivity ?? false,
      },
    },
  });
}
