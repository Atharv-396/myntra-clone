/**
 * NotificationRoutes.js
 * All notification-related API endpoints.
 * Follows existing project conventions (userId from body/params, not JWT).
 *
 * Routes:
 *   POST   /api/notifications/devices              — register device token
 *   DELETE /api/notifications/devices/:deviceId    — deactivate device (on logout)
 *   GET    /api/notifications                       — get notification history
 *   GET    /api/notifications/unread-count          — unread count
 *   PATCH  /api/notifications/:id/read             — mark one read
 *   PATCH  /api/notifications/read-all             — mark all read
 *   GET    /api/notifications/preferences          — get preferences
 *   PATCH  /api/notifications/preferences          — update preferences
 *   POST   /api/notifications/receipts/process     — trigger receipt processing
 *   POST   /api/admin/notifications/campaigns      — send promo (admin only)
 */

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const PushDevice = require("../models/PushDevice");
const NotificationPreference = require("../models/NotificationPreference");
const Notification = require("../models/Notification");
const { isValidExpoPushToken } = require("../providers/expoNotificationProvider");
const { sendNotification, processReceipts, scanAbandonedCarts } = require("../services/notificationService");
const { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } = require("../constants/notificationTypes");

// ─── Helper: validate userId ────────────────────────────────────────────────
function validateUserId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE REGISTRATION
// POST /api/notifications/devices
// Body: { userId, expoPushToken, deviceId, platform, appVersion }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/devices", async (req, res) => {
  try {
    const { userId, expoPushToken, deviceId, platform = "android", appVersion = "" } = req.body;

    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });
    if (!expoPushToken || !isValidExpoPushToken(expoPushToken))
      return res.status(400).json({ message: "Valid Expo Push Token is required" });
    if (!deviceId) return res.status(400).json({ message: "deviceId is required" });

    // Upsert: one active record per userId+deviceId
    const device = await PushDevice.findOneAndUpdate(
      { userId, deviceId },
      {
        userId,
        expoPushToken,
        deviceId,
        platform,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Ensure preferences exist (create with defaults if first time)
    await NotificationPreference.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ message: "Device registered", deviceId: device.deviceId });
  } catch (err) {
    console.log("POST /devices error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE UNREGISTRATION
// DELETE /api/notifications/devices/:deviceId
// Body: { userId }
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/devices/:deviceId", async (req, res) => {
  try {
    const { userId } = req.body;
    const { deviceId } = req.params;

    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });

    await PushDevice.findOneAndUpdate(
      { userId, deviceId },
      { isActive: false }
    );

    return res.status(200).json({ message: "Device deactivated" });
  } catch (err) {
    console.log("DELETE /devices error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION HISTORY
// GET /api/notifications?userId=&page=1&limit=20&category=&unread=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userId, page = 1, limit = 20, category, unread } = req.query;

    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });

    const query = { userId };
    if (category) query.category = category.toUpperCase();
    if (unread === "true") query.readAt = { $exists: false };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, readAt: { $exists: false }, status: { $ne: "FAILED" } }),
    ]);

    return res.status(200).json({
      notifications,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      unreadCount,
    });
  } catch (err) {
    console.log("GET /notifications error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UNREAD COUNT — MUST be before /:id routes
// GET /api/notifications/unread-count?userId=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/unread-count", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });

    const count = await Notification.countDocuments({
      userId,
      readAt: { $exists: false },
      status: { $ne: "FAILED" },
    });

    return res.status(200).json({ unreadCount: count });
  } catch (err) {
    console.log("GET /unread-count error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK ALL READ — MUST be before /:id
// PATCH /api/notifications/read-all
// Body: { userId }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/read-all", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });

    await Notification.updateMany(
      { userId, readAt: { $exists: false } },
      { readAt: new Date(), status: "READ" }
    );

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (err) {
    console.log("PATCH /read-all error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

const ALL_PREF_FIELDS = [
  "orderNotifications",
  "paymentNotifications",
  "shippingNotifications",
  "deliveryNotifications",
  "wishlistNotifications",
  "stockNotifications",
  "promotionNotifications",
  "cartNotifications",
];

function ensureAllPrefFields(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const defaults = {};
  let needsSave = false;
  for (const f of ALL_PREF_FIELDS) {
    if (obj[f] === undefined || obj[f] === null) {
      obj[f] = true;
      defaults[f] = true;
      needsSave = true;
    }
  }
  return { normalized: obj, defaults, needsSave };
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFERENCES — before /:id
// GET /api/notifications/preferences?userId=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preferences", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });

    let pref = await NotificationPreference.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { normalized, defaults, needsSave } = ensureAllPrefFields(pref);
    if (needsSave) {
      pref = await NotificationPreference.findOneAndUpdate(
        { userId },
        { $set: defaults },
        { new: true }
      );
      const result = ensureAllPrefFields(pref);
      return res.status(200).json(result.normalized);
    }

    return res.status(200).json(normalized);
  } catch (err) {
    console.log("GET /preferences error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/preferences
// Body: { userId, orderNotifications, paymentNotifications, ... }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/preferences", async (req, res) => {
  try {
    const {
      userId,
      orderNotifications, paymentNotifications, shippingNotifications,
      deliveryNotifications, wishlistNotifications, stockNotifications,
      promotionNotifications, cartNotifications,
    } = req.body;

    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });

    const boolFields = {
      orderNotifications, paymentNotifications, shippingNotifications,
      deliveryNotifications, wishlistNotifications, stockNotifications,
      promotionNotifications, cartNotifications,
    };

    const updates = {};
    for (const [key, val] of Object.entries(boolFields)) {
      if (val !== undefined) {
        if (typeof val !== "boolean")
          return res.status(400).json({ message: `${key} must be a boolean` });
        updates[key] = val;
      }
    }

    let pref = await NotificationPreference.findOneAndUpdate(
      { userId },
      { $set: updates },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { normalized, defaults, needsSave } = ensureAllPrefFields(pref);
    if (needsSave) {
      pref = await NotificationPreference.findOneAndUpdate(
        { userId },
        { $set: defaults },
        { new: true }
      );
      const result = ensureAllPrefFields(pref);
      return res.status(200).json(result.normalized);
    }

    return res.status(200).json(normalized);
  } catch (err) {
    console.log("PATCH /preferences error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT PROCESSING (lightweight, on-demand)
// POST /api/notifications/receipts/process
// ─────────────────────────────────────────────────────────────────────────────
router.post("/receipts/process", async (req, res) => {
  try {
    await processReceipts();
    return res.status(200).json({ message: "Receipt processing complete" });
  } catch (err) {
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Abandoned cart scan (admin on-demand trigger)
// POST /api/notifications/admin/abandoned-cart/scan
// Body: { adminSecret?, abandonedAfterHours? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/abandoned-cart/scan", async (req, res) => {
  try {
    const { adminSecret, abandonedAfterHours } = req.body;

    // Basic admin check — uses JWT_SECRET as admin secret for simplicity
    if (adminSecret !== undefined && adminSecret !== process.env.JWT_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const result = await scanAbandonedCarts({ abandonedAfterHours });
    return res.status(200).json({ message: "Abandoned cart scan complete", ...result });
  } catch (err) {
    console.log("POST /admin/abandoned-cart/scan error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK ONE READ
// PATCH /api/notifications/:id/read
// Body: { userId }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;

    if (!validateUserId(userId)) return res.status(400).json({ message: "Valid userId is required" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid notification ID" });

    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId }, // userId ensures ownership
      { readAt: new Date(), status: "READ" },
      { new: true }
    );

    if (!notif) return res.status(404).json({ message: "Notification not found" });
    return res.status(200).json(notif);
  } catch (err) {
    console.log("PATCH /:id/read error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: SEND PROMOTIONAL CAMPAIGN
// POST /api/notifications/admin/campaign
// Body: { adminSecret, title, body, data, userIds? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/campaign", async (req, res) => {
  try {
    const { adminSecret, title, body, data = {}, userIds } = req.body;

    // Basic admin check — uses JWT_SECRET as admin secret for simplicity
    // In production, replace with a proper admin role
    if (!adminSecret || adminSecret !== process.env.JWT_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!title || !body) return res.status(400).json({ message: "title and body are required" });

    let targets = userIds;
    if (!targets || targets.length === 0) {
      // Send to all users with active devices
      const devices = await PushDevice.find({ isActive: true }).distinct("userId");
      targets = devices.map((id) => id.toString());
    }

    // Fire and forget — respond immediately
    res.status(202).json({ message: "Campaign queued", recipientCount: targets.length });

    // Send in background
    const { sendToMultipleUsers } = require("../services/notificationService");
    sendToMultipleUsers(targets, {
      category: NOTIFICATION_CATEGORIES.PROMOTION,
      type: NOTIFICATION_TYPES.PROMOTIONAL_CAMPAIGN,
      title,
      body,
      data: { ...data, type: "PROMOTIONAL_CAMPAIGN", category: "PROMOTION" },
      idempotencyKey: data.campaignId ? `campaign:${data.campaignId}` : "",
    }).catch((e) => console.log("Campaign send error:", e.message));
  } catch (err) {
    console.log("POST /admin/campaign error:", err.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;
