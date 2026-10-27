import { LockerRequest } from "../models/LockerRequest.model.js";

export async function syncResolvedUnits(user: any): Promise<number> {
  const reqs = await LockerRequest.find({ userId: user._id, status: { $ne: "rejected" } }).lean();
  const total = reqs.reduce((sum: number, r: any) => sum + (r.units || 1), 0);
  const resolved = Math.max(total, user.assignedDevices?.length || 0);
  if (user.units !== resolved) {
    user.units = resolved;
    await user.save();
  }
  return resolved;
}
