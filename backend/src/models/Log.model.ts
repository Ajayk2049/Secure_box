import mongoose, { Schema, Document } from "mongoose";

export interface ILog extends Document {
  deviceId?: mongoose.Types.ObjectId;
  action:
    | "unlock"
    | "lock"
    | "emergency_unlock"
    | "manual_unlock"
    | "door_open"
    | "door_close"
    | "delivery_success"
    | "co_owner_added"
    | "co_owner_removed"
    | "admin_slot_update"
    | "slot_upgrade_requested"
    | "order_requested"
    | "order_approved"
    | "order_rejected"
    | "user_signup"
    | "device_online"
    | "device_offline";
  timestamp: Date;
  metadata?: Record<string, unknown>;
}


const logSchema = new Schema<ILog>(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: false,
    },
    action: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

logSchema.index({ deviceId: 1, timestamp: -1 });

export const Log = mongoose.model<ILog>("Log", logSchema);
