import { FastifyInstance } from "fastify";
import { adminMiddleware } from "../middlewares/admin.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  createDeviceForUserSchema,
  updateDeviceSlotsSchema,
  createCustomerSchema,
  updateRequestStatusSchema,
  updateSlotPricingSchema,
  slotRequestActionSchema,
} from "../schemas/admin.schemas.js";
import {
  getAllDevices,
  getAllUsers,
  getSystemStats,
  updateDeviceSlots,
  createDeviceForUser,
  deleteDevice,
  createCustomer,
  getSystemLogs,
  getDeviceLogsForAdmin,
  rotateDeviceKey,
} from "../controllers/admin.controller.js";
import {
  getAllRequests,
  updateRequestStatus,
} from "../controllers/adminRequests.controller.js";
import {
  getSlotPricing,
  updateSlotPricing,
  getAllSlotRequests,
  approveSlotRequest,
  rejectSlotRequest,
  revokeSlotRequest,
} from "../controllers/pricing.controller.js";

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", adminMiddleware);

  fastify.get("/admin/devices", {
    handler: getAllDevices,
  });

  fastify.post("/admin/devices", {
    preHandler: [validateBody(createDeviceForUserSchema)],
    handler: createDeviceForUser,
  });

  fastify.delete("/admin/devices/:id", {
    handler: deleteDevice,
  });

  fastify.patch("/admin/devices/:id/slots", {
    preHandler: [validateBody(updateDeviceSlotsSchema)],
    handler: updateDeviceSlots,
  });

  fastify.post("/admin/devices/:id/rotate-key", {
    handler: rotateDeviceKey,
  });

  fastify.get("/admin/users", {
    handler: getAllUsers,
  });

  fastify.post("/admin/users", {
    preHandler: [validateBody(createCustomerSchema)],
    handler: createCustomer,
  });

  fastify.get("/admin/stats", {
    handler: getSystemStats,
  });

  // Order / Locker Delivery Requests
  fastify.get("/admin/requests", {
    handler: getAllRequests,
  });

  fastify.patch("/admin/requests/:id/status", {
    preHandler: [validateBody(updateRequestStatusSchema)],
    handler: updateRequestStatus,
  });

  // System & Device Logs
  fastify.get("/admin/logs", {
    handler: getSystemLogs,
  });

  fastify.get("/admin/devices/:id/logs", {
    handler: getDeviceLogsForAdmin,
  });

  // Slot Pricing (Admin view & edit)
  fastify.get("/admin/pricing/slots", {
    handler: getSlotPricing,
  });

  fastify.patch("/admin/pricing/slots", {
    preHandler: [validateBody(updateSlotPricingSchema)],
    handler: updateSlotPricing,
  });

  // Slot Upgrade Applications (Admin review, customer contact, approve all 3 slots, revoke back to 2 slots)
  fastify.get("/admin/slot-requests", {
    handler: getAllSlotRequests,
  });

  fastify.patch("/admin/slot-requests/:id/approve", {
    preHandler: [validateBody(slotRequestActionSchema)],
    handler: approveSlotRequest,
  });

  fastify.patch("/admin/slot-requests/:id/reject", {
    preHandler: [validateBody(slotRequestActionSchema)],
    handler: rejectSlotRequest,
  });

  fastify.patch("/admin/slot-requests/:id/revoke", {
    preHandler: [validateBody(slotRequestActionSchema)],
    handler: revokeSlotRequest,
  });
}

