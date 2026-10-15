import { z } from "zod";

export const addCoOwnerSchema = z.object({
  email: z.string().email("Valid email address is required"),
});

export const joinDeviceSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
});

export const renameCoOwnerSchema = z.object({
  nickname: z.string().optional(),
});

export const requestSlotUpgradeSchema = z.object({
  desiredSlots: z.number().optional(),
  notes: z.string().optional(),
  plan: z.enum(["monthly", "yearly"]).optional(),
});

export const deviceTelemetrySchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  doorState: z.enum(["open", "closed"]),
  solenoidState: z.enum(["energized", "released"]).optional(),
  rssi: z.number().optional(),
});

export const deviceHeartbeatSchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  rssi: z.number().optional(),
});
