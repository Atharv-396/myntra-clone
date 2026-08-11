/**
 * notificationService.js
 * Central service for all push notifications.
 * All 7 notification categories go through here.
 * Business controllers (order, payment, wishlist, product) call this — never Expo directly.
 */

const mongoose = require("mongoose");
const Bag = require("../models/Bag");
const Product = require("../models/Product");
const PushDevice = require("../models/PushDevice");
const NotificationPreference = require("../models/NotificationPreference");
const Notification = require("../models/Notification");
const { TYPE_TO_PREFERENCE, NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } = require("../constants/notificationTypes");
const { sendNotifications, getReceipts } = require("../providers/expoNotificationProvider");

/**
 * Send a push notification to a user.
 * Fire-and-forget pattern — never throws, never blocks the caller.
 *
 * @param {Object} opts
 * @param {string} opts.userId          - MongoDB ObjectId string
 * @param {string} opts.category        - NOTIFICATION_CATEGORIES value
 * @param {string} opts.type            - NOTIFICATION_TYPES value
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {Object} [opts.data]          - Navigation payload (safe data only)
 * @param {string} [opts.idempotencyKey] - Prevents duplicate sends for same event
 */
async function sendNotification({ userId, category, type, title, body, data = {}, idempotencyKey = "" }) {
  try {
    if (!userId || !category || !type || !title || !body) {
      console.log("[Notification] Missing required fields, skipping");
      return;
    }

    // ── Duplicate check ──────────────────────────────────────────────────
    if (idempotencyKey) {
      const existing = await Notification.findOne({ idempotencyKey });
      if (existing) {
        console.log(`[Notification] Duplicate skipped: ${idempotencyKey}`);
        return;
      }
    }

    // ── Check user preference ────────────────────────────────────────────
    const prefField = TYPE_TO_PREFERENCE[type];
    if (prefField) {
      const pref = await NotificationPreference.findOne({ userId });
      // If preference exists and is explicitly false, skip
      if (pref && pref[prefField] === false) {
        console.log(`[Notification] Preference disabled (${prefField}) for user ${userId}`);
        return;
      }
    }

    // ── Get active device tokens ─────────────────────────────────────────
    const devices = await PushDevice.find({ userId, isActive: true }).lean();
    if (devices.length === 0) {
      console.log(`[Notification] No active devices for user ${userId}`);
      // Still create a notification record even without devices
      await Notification.create({
        userId,
        category,
        type,
        title,
        body,
        data,
        status: "FAILED",
        errorCode: "NO_DEVICES",
        errorMessage: "User has no active push devices",
        idempotencyKey,
      });
      return;
    }

    // ── Create notification records (one per device) ─────────────────────
    const notifDocs = await Notification.insertMany(
      devices.map((d) => ({
        userId,
        deviceId: d.deviceId,
        category,
        type,
        title,
        body,
        data,
        status: "PENDING",
        idempotencyKey: idempotencyKey ? `${idempotencyKey}:${d.deviceId}` : "",
      }))
    );

    // ── Send via Expo ─────────────────────────────────────────────────────
    const messages = devices.map((d, idx) => ({
      expoPushToken: d.expoPushToken,
      title,
      body,
      data: { ...data, category, type },
      channelId: category.toLowerCase(),
    }));

    const results = await sendNotifications(messages);

    // ── Update notification records with Expo results ────────────────────
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const notifDoc = notifDocs[i];
      if (!notifDoc) continue;

      if (result.status === "ok") {
        await Notification.findByIdAndUpdate(notifDoc._id, {
          status: "SENT",
          expoTicketId: result.ticketId || "",
          sentAt: new Date(),
        });
      } else {
        await Notification.findByIdAndUpdate(notifDoc._id, {
          status: "FAILED",
          errorCode: result.error || "ExpoError",
          errorMessage: result.message || "",
        });

        // Deactivate invalid tokens
        if (result.error === "DeviceNotRegistered" || result.error === "InvalidExpoToken") {
          await PushDevice.findOneAndUpdate(
            { userId, expoPushToken: result.token },
            { isActive: false }
          );
          console.log(`[Notification] Deactivated invalid token for user ${userId}`);
        }
      }
    }

    // Update lastUsedAt for active devices
    await PushDevice.updateMany(
      { userId, isActive: true },
      { lastUsedAt: new Date() }
    );

    console.log(`[Notification] Sent ${type} to user ${userId} (${results.length} devices)`);
  } catch (err) {
    console.log("[Notification] sendNotification error:", err.message);
    // Never throw — notification failure must not break business operations
  }
}

/**
 * Send to multiple users at once (promotional campaigns, price drops, restocks).
 * @param {string[]} userIds
 * @param {Object} opts — same fields as sendNotification minus userId
 */
async function sendToMultipleUsers(userIds, opts) {
  for (const userId of userIds) {
    await sendNotification({ userId, ...opts });
  }
}

/**
 * Process Expo receipts for notifications with pending ticket IDs.
 * Updates SENT → DELIVERED or FAILED based on receipt.
 * Call this manually or from a lightweight interval.
 */
async function processReceipts() {
  try {
    const pending = await Notification.find({
      status: "SENT",
      expoTicketId: { $ne: "" },
    })
      .limit(100)
      .lean();

    if (pending.length === 0) return;

    const ticketIds = pending.map((n) => n.expoTicketId).filter(Boolean);
    const response = await getReceipts(ticketIds);
    const receipts = response?.receipts || {};

    for (const notif of pending) {
      const receipt = receipts[notif.expoTicketId];
      if (!receipt) continue;

      if (receipt.status === "ok") {
        await Notification.findByIdAndUpdate(notif._id, {
          status: "DELIVERED",
          expoReceiptStatus: "ok",
          deliveredAt: new Date(),
        });
      } else if (receipt.status === "error") {
        const errCode = receipt.details?.error || "ExpoReceiptError";
        await Notification.findByIdAndUpdate(notif._id, {
          status: "FAILED",
          expoReceiptStatus: "error",
          errorCode: errCode,
          errorMessage: receipt.message || "",
        });

        // Deactivate invalid tokens
        if (errCode === "DeviceNotRegistered") {
          const notifFull = await Notification.findById(notif._id);
          if (notifFull) {
            await PushDevice.findOneAndUpdate(
              { userId: notifFull.userId, deviceId: notifFull.deviceId },
              { isActive: false }
            );
          }
        }
      }
    }

    console.log(`[Notification] Processed ${ticketIds.length} receipts`);
  } catch (err) {
    console.log("[Notification] processReceipts error:", err.message);
  }
}

async function scanAbandonedCarts(options = {}) {
  try {
    const abandonedAfterHours = Number(options.abandonedAfterHours) || 1;
    const now = new Date();
    const abandonedCutoff = new Date(now.getTime() - abandonedAfterHours * 60 * 60 * 1000);

    if (abandonedAfterHours <= 0) {
      throw new Error("abandonedAfterHours must be a positive number");
    }

    const distinctUserIds = await Bag.distinct("userId", {
      savedForLater: false,
      updatedAt: { $lte: abandonedCutoff },
    });

    const targetUserIds = [];
    for (const userId of distinctUserIds) {
      const activeDevices = await PushDevice.countDocuments({ userId, isActive: true });
      if (activeDevices === 0) continue;

      const recentOrder = await mongoose.models.Order?.findOne({ userId, createdAt: { $gte: abandonedCutoff } }).select("_id").lean();
      if (recentOrder) continue;

      const existingReminder = await Notification.countDocuments({
        userId,
        type: NOTIFICATION_TYPES.CART_ABANDONED,
        createdAt: { $gte: abandonedCutoff },
      });
      if (existingReminder > 0) continue;

      targetUserIds.push(userId.toString());
    }

    let sentCount = 0;
    for (const userId of targetUserIds) {
      const items = await Bag.find({ userId, savedForLater: false }).sort({ updatedAt: -1 }).limit(3).populate("productId").lean();
      if (items.length === 0) continue;

      const firstItem = items.find((i) => i.productId) || items[0];
      const productName = firstItem.productId?.name || "your items";
      const grandTotal = items.reduce((sum, i) => {
        const price = Number(i.priceAtAdd || i.productId?.price || 0);
        const qty = Number(i.quantity || 1);
        return sum + price * qty;
      }, 0);

      let body = `You left ${items.length} item${items.length > 1 ? "s" : ""} in your bag. Checkout before they sell out!`;
      if (grandTotal > 0) {
        body = `You left items worth ₹${grandTotal} in your bag. Complete your order now.`;
      }

      await sendNotification({
        userId,
        category: NOTIFICATION_CATEGORIES.CART,
        type: NOTIFICATION_TYPES.CART_ABANDONED,
        title: "Your bag is waiting for you",
        body,
        data: {
          type: NOTIFICATION_TYPES.CART_ABANDONED,
          category: NOTIFICATION_CATEGORIES.CART,
          productId: firstItem.productId?._id?.toString() || "",
        },
        idempotencyKey: `cart_abandoned:${userId}:${Math.floor(abandonedCutoff.getTime() / 3600000)}`,
      });
      sentCount += 1;
    }

    return {
      scannedAt: now.toISOString(),
      abandonedAfterHours,
      scannedUsers: distinctUserIds.length,
      eligibleUsers: targetUserIds.length,
      notificationsSent: sentCount,
    };
  } catch (err) {
    console.log("[Notification] scanAbandonedCarts error:", err.message);
    throw err;
  }
}

module.exports = { sendNotification, sendToMultipleUsers, processReceipts, scanAbandonedCarts };
