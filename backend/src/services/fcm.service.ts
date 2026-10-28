import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { User } from "../models/User.model.js";
import { IDevice } from "../models/Device.model.js";

class FcmService {
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (getApps().length > 0) {
      this.isInitialized = true;
      return;
    }

    try {
      const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
        initializeApp({
          credential: cert(serviceAccount),
        });
        this.isInitialized = true;
        console.log("[FCM] Firebase Admin SDK initialized successfully");
      } else {
        console.warn("[FCM] firebase-service-account.json not found at:", serviceAccountPath);
      }
    } catch (err) {
      console.error("[FCM] Failed to initialize Firebase Admin SDK:", err);
    }
  }

  /**
   * Dispatches push notification to all owners and co-owners of the device.
   */
  async sendToDeviceStakeholders(
    device: IDevice | any,
    title: string,
    body: string,
    extraData: Record<string, string> = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      this.init();
      if (!this.isInitialized) return;
    }

    try {
      // Collect owner and co-owners
      const userIds: any[] = [];
      if (device.ownerId) userIds.push(device.ownerId);
      if (Array.isArray(device.coOwners)) {
        userIds.push(...device.coOwners);
      }

      if (userIds.length === 0) return;

      const users = await User.find({ _id: { $in: userIds } })
        .select("fcmTokens notificationPreferences")
        .lean();
      const allTokens: string[] = [];
      const eventType = extraData?.eventType;

      for (const u of users) {
        // Push notifications are OFF by default unless explicitly enabled in user settings
        const prefs = (u as any).notificationPreferences;
        let isEnabledForUser = false;

        if (eventType === "LOCKER_OPENED") {
          isEnabledForUser = prefs?.doorStatus === true;
        } else if (eventType === "DEVICE_OFFLINE" || eventType === "DEVICE_ONLINE") {
          isEnabledForUser = prefs?.lockerConnectivity === true;
        }

        if (!isEnabledForUser) {
          console.log(
            `[FCM] Skipped push for user ${u._id}: ${eventType || "EVENT"} disabled (doorStatus: ${prefs?.doorStatus ?? false}, lockerConnectivity: ${prefs?.lockerConnectivity ?? false})`
          );
          continue;
        }

        console.log(`[FCM] Allowed push for user ${u._id}: ${eventType} enabled in preferences`);

        if (Array.isArray(u.fcmTokens)) {
          for (const token of u.fcmTokens) {
            if (token && typeof token === "string" && !allTokens.includes(token)) {
              allTokens.push(token);
            }
          }
        }
      }

      if (allTokens.length === 0) {
        console.log(`[FCM] No eligible recipient tokens for '${title}' [${eventType || "N/A"}]`);
        return;
      }

      const payload: MulticastMessage = {
        tokens: allTokens,
        notification: {
          title,
          body,
        },
        data: {
          deviceId: String(device.deviceId || ""),
          deviceName: String(device.name || "Secure Box"),
          ...extraData,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "secure_box_alerts",
            sound: "default",
            priority: "high",
          },
        },
      };

      const messaging = getMessaging();
      const response = await messaging.sendEachForMulticast(payload);
      console.log(`[FCM] Dispatched '${title}' to ${response.successCount}/${allTokens.length} devices`);

      // Clean up dead/unregistered tokens
      if (response.failureCount > 0) {
        const deadTokens: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered"
            ) {
              deadTokens.push(allTokens[idx]);
            }
          }
        });

        if (deadTokens.length > 0) {
          await User.updateMany(
            { fcmTokens: { $in: deadTokens } },
            { $pull: { fcmTokens: { $in: deadTokens } } }
          ).catch((e) => console.error("[FCM] Error pruning dead tokens:", e));
        }
      }
    } catch (err) {
      console.error("[FCM] Error sending push notification:", err);
    }
  }

  async notifyLockerOpened(device: IDevice | any): Promise<void> {
    const boxName = device.name || device.deviceId || "Secure Box";
    await this.sendToDeviceStakeholders(
      device,
      "Locker Opened",
      `Box "${boxName}" has been unlocked and opened.`,
      { eventType: "LOCKER_OPENED" }
    );
  }

  async notifyDeviceOnline(device: IDevice | any): Promise<void> {
    const boxName = device.name || device.deviceId || "Secure Box";
    await this.sendToDeviceStakeholders(
      device,
      "Device Online",
      `Box "${boxName}" is back online and connected.`,
      { eventType: "DEVICE_ONLINE" }
    );
  }

  async notifyDeviceOffline(device: IDevice | any): Promise<void> {
    const boxName = device.name || device.deviceId || "Secure Box";
    await this.sendToDeviceStakeholders(
      device,
      "Device Offline",
      `Box "${boxName}" is currently unreachable (offline).`,
      { eventType: "DEVICE_OFFLINE" }
    );
  }
}

export const fcmService = new FcmService();
