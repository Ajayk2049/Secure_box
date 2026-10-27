import { z } from "zod";

export const createDeviceForUserSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required").max(64, "Device ID too long"),
  name: z.string().min(1, "Device name is required").max(100, "Device name too long"),
  ownerId: z.string().min(1, "Owner user ID is required"),
});

export const updateDeviceSlotsSchema = z.object({
  allowedSlots: z.number().int().min(2, "Minimum 2 slots required").max(5, "Maximum 5 slots capacity"),
});

export const createCustomerSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  name: z.string().max(100).optional(),
  password: z.string().min(6, "Password must be at least 6 characters long").max(12, "Password must not exceed 12 characters"),
}).refine(
  (data) => (data.phone && data.phone.trim().length > 0) || (data.email && data.email.trim().length > 0),
  {
    message: "Either phone number or email is required",
    path: ["phone"],
  }
);

export const updateRequestStatusSchema = z.object({
  status: z.enum(["preparing", "dispatched", "delivered", "approved", "rejected"]),
  deviceId: z.string().max(64).optional(),
  rejectionReason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  verificationNotes: z.string().max(500).optional(),
});

export const updateSlotPricingSchema = z.object({
  monthlyPrice: z.number().positive("Monthly price must be greater than 0"),
  yearlyPrice: z.number().positive("Yearly price must be greater than 0"),
  currency: z.string().min(1).max(5).optional(),
});

export const slotRequestActionSchema = z.object({
  adminNotes: z.string().max(500).optional(),
});
