import mongoose, { Schema, Document } from "mongoose";

export type SlotRequestStatus = "pending" | "approved" | "rejected";

export interface ISlotRequest extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  deviceStringId: string;
  deviceName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  currentSlots: number;
  desiredSlots: number;
  plan: "monthly" | "yearly";
  priceAtRequest: number;
  status: SlotRequestStatus;
  notes?: string;
  adminNotes?: string;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const slotRequestSchema = new Schema<ISlotRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    deviceStringId: {
      type: String,
      required: true,
      trim: true,
    },
    deviceName: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
    },
    currentSlots: {
      type: Number,
      required: true,
      default: 2,
    },
    desiredSlots: {
      type: Number,
      required: true,
      default: 5,
    },
    plan: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "yearly",
    },
    priceAtRequest: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

slotRequestSchema.index({ status: 1, createdAt: -1 });

export const SlotRequest = mongoose.model<ISlotRequest>(
  "SlotRequest",
  slotRequestSchema
);
