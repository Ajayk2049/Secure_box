import mongoose, { Schema, Document } from "mongoose";

export type LockerRequestStatus = "pending" | "preparing" | "dispatched" | "delivered" | "approved" | "rejected";

export interface ILockerRequest extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  address: string;
  pincode: string;
  units: number;
  status: LockerRequestStatus;
  assignedDeviceIds: string[];
  rejectionReason?: string;
  notes?: string;
  verificationNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lockerRequestSchema = new Schema<ILockerRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    units: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    status: {
      type: String,
      enum: ["pending", "preparing", "dispatched", "delivered", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    assignedDeviceIds: [
      {
        type: String,
        trim: true,
      },
    ],
    rejectionReason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    verificationNotes: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    dispatchedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

lockerRequestSchema.index({ userId: 1, createdAt: -1 });
lockerRequestSchema.index({ status: 1, createdAt: -1 });

export const LockerRequest = mongoose.model<ILockerRequest>(
  "LockerRequest",
  lockerRequestSchema
);
