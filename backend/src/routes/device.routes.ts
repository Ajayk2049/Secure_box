import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { adminMiddleware } from "../middlewares/admin.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  addCoOwnerSchema,
  joinDeviceSchema,
  renameCoOwnerSchema,
  requestSlotUpgradeSchema,
  deviceTelemetrySchema,
  deviceHeartbeatSchema,
} from "../schemas/device.schemas.js";
import {
  getDevices,
  createDevice,
  unlockDevice,
  getDeviceLogs,
  updateDeviceName,
} from "../controllers/device.controller.js";

import {
  testUnlockDevice,
  getDeviceCommand,
  receiveTelemetry,
  receiveHeartbeat,
} from "../controllers/deviceIot.controller.js";
import {
  addCoOwner,
  removeCoOwner,
  renameCoOwner,
  getDeviceSlots,
  requestSlotUpgrade,
  createInviteCode,
  cancelInviteCode,
  joinDevice,
} from "../controllers/deviceSlot.controller.js";
import { getSlotPricing } from "../controllers/pricing.controller.js";

export default async function deviceRoutes(fastify: FastifyInstance) {
  // 1. Diagnostic endpoint for hardware bench testing (Protected by Admin Auth in production)
  fastify.post("/test/unlock", {
    onRequest: process.env.NODE_ENV === "production" ? [adminMiddleware] : [],
    handler: testUnlockDevice,
  });

  // 1b. Public pricing endpoint for mobile app & web
  fastify.get("/pricing/slots", {
    handler: getSlotPricing,
  });

  // 2. IoT Hardware endpoints (ESP32 REST/HTTP short-polling & telemetry)
  // High-capacity rate limit (360 req/min) prevents polling starvation while protecting from DoS floods
  const iotRateLimit = {
    config: {
      rateLimit: {
        max: 360,
        timeWindow: "1 minute",
      },
    },
  };

  fastify.get("/device/command", {
    ...iotRateLimit,
    handler: getDeviceCommand,
  });

  fastify.post("/device/telemetry", {
    ...iotRateLimit,
    preHandler: [validateBody(deviceTelemetrySchema)],
    handler: receiveTelemetry,
  });

  fastify.post("/device/heartbeat", {
    ...iotRateLimit,
    preHandler: [validateBody(deviceHeartbeatSchema)],
    handler: receiveHeartbeat,
  });

  // 3. Protected user endpoints (require valid JWT)
  fastify.register(async (authScope) => {
    authScope.addHook("onRequest", authMiddleware);

    // Core device management
    authScope.get("/devices", {
      handler: getDevices,
    });

    authScope.post("/devices", {
      handler: createDevice,
    });

    authScope.post("/devices/:id/unlock", {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      handler: unlockDevice,
    });

    authScope.get("/devices/:id/logs", {
      handler: getDeviceLogs,
    });

    authScope.patch("/devices/:id/name", {
      handler: updateDeviceName,
    });

    // Multi-user slot & invite management
    authScope.post("/devices/:id/co-owners", {
      preHandler: [validateBody(addCoOwnerSchema)],
      handler: addCoOwner,
    });

    authScope.delete("/devices/:id/co-owners/:userId", {
      handler: removeCoOwner,
    });

    authScope.patch("/devices/:id/co-owners/:userId", {
      preHandler: [validateBody(renameCoOwnerSchema)],
      handler: renameCoOwner,
    });

    authScope.get("/devices/:id/slots", {
      handler: getDeviceSlots,
    });

    authScope.post("/devices/:id/slots/upgrade", {
      preHandler: [validateBody(requestSlotUpgradeSchema)],
      handler: requestSlotUpgrade,
    });

    // Join Code system
    authScope.post("/devices/:id/invite", {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      handler: createInviteCode,
    });

    authScope.delete("/devices/:id/invite", {
      handler: cancelInviteCode,
    });

    authScope.post("/devices/join", {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      preHandler: [validateBody(joinDeviceSchema)],
      handler: joinDevice,
    });
  });
}
