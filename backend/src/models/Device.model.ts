import mongoose, { Schema, Document } from "mongoose";

export interface IDevice extends Document {
  deviceId: string;
  ownerId: mongoose.Types.ObjectId;
  coOwners: mongoose.Types.ObjectId[];
  coOwnerNicknames?: Map<string, string>;
  allowedSlots: number;
  name: string;
  doorState: "open" | "closed";
  online: boolean;
  lastHeartbeat?: Date;
  deviceKey?: string;
  inviteCode?: string;
  inviteExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coOwners: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    coOwnerNicknames: {
      type: Map,
      of: String,
      default: {},
    },
    allowedSlots: {
      type: Number,
      default: 2,
      min: 2,
      max: 5,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    doorState: {
      type: String,
      enum: ["open", "closed"],
      default: "closed",
    },
    online: {
      type: Boolean,
      default: false,
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
    deviceKey: {
      type: String,
      trim: true,
    },
    inviteCode: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

deviceSchema.index({ ownerId: 1 });
deviceSchema.index({ coOwners: 1 });
deviceSchema.index({ online: 1 });
deviceSchema.index({ online: 1, lastHeartbeat: 1 });

export const Device = mongoose.model<IDevice>("Device", deviceSchema);
