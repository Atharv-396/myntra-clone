/**
 * expoNotificationProvider.js
 * All direct communication with the Expo Push Notification Service.
 * Nothing outside this file should call the Expo API directly.
 *
 * Uses EXPO_ACCESS_TOKEN from environment — never hardcoded, never exposed to frontend.
 */

const https = require("https");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_BATCH = 100; // Expo limit per request

/** Validate that a string looks like an Expo push token */
function isValidExpoPushToken(token) {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );
}

/**
 * Build the Authorization header if EXPO_ACCESS_TOKEN is set.
 * Returns empty string if not set (token optional for development).
 */
function getAuthHeader() {
  const token = process.env.EXPO_ACCESS_TOKEN;
  return token ? `Bearer ${token}` : "";
}

/**
 * Send a batch of Expo messages (max 100).
 * Returns { tickets: [...] }
 */
async function sendBatch(messages) {
  const authHeader = getAuthHeader();

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  if (authHeader) headers["Authorization"] = authHeader;

  const body = JSON.stringify(messages);

  return new Promise((resolve, reject) => {
    const req = https.request(
      EXPO_PUSH_URL,
      { method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error("Invalid JSON from Expo: " + data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Fetch Expo receipts for a list of ticket IDs.
 * Returns { receipts: { [ticketId]: { status, details? } } }
 */
async function getReceipts(ticketIds) {
  if (!ticketIds || ticketIds.length === 0) return { receipts: {} };

  const authHeader = getAuthHeader();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authHeader) headers["Authorization"] = authHeader;

  const body = JSON.stringify({ ids: ticketIds });

  return new Promise((resolve, reject) => {
    const req = https.request(
      EXPO_RECEIPTS_URL,
      { method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Invalid JSON from Expo receipts: " + data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Send notifications to multiple devices.
 * @param {Array} items  — [{ expoPushToken, title, body, data, sound, channelId }]
 * @returns {Array}      — [{ token, ticketId, status, error }]
 */
async function sendNotifications(items) {
  const results = [];

  // Filter valid tokens
  const valid = items.filter((i) => isValidExpoPushToken(i.expoPushToken));
  const invalid = items.filter((i) => !isValidExpoPushToken(i.expoPushToken));

  // Mark invalid tokens immediately
  for (const item of invalid) {
    results.push({
      token: item.expoPushToken,
      status: "error",
      error: "InvalidExpoToken",
      ticketId: null,
    });
  }

  // Build Expo messages
  const messages = valid.map((item) => ({
    to: item.expoPushToken,
    sound: item.sound || "default",
    title: item.title,
    body: item.body,
    data: item.data || {},
    channelId: item.channelId || "default",
    priority: "high",
  }));

  // Send in batches of MAX_BATCH
  for (let i = 0; i < messages.length; i += MAX_BATCH) {
    const batch = messages.slice(i, i + MAX_BATCH);
    const batchTokens = valid.slice(i, i + MAX_BATCH);

    try {
      const response = await sendBatch(batch);
      const tickets = response.data || [];

      tickets.forEach((ticket, idx) => {
        const token = batchTokens[idx]?.expoPushToken;
        if (ticket.status === "ok") {
          results.push({ token, status: "ok", ticketId: ticket.id, error: null });
        } else {
          results.push({
            token,
            status: "error",
            ticketId: null,
            error: ticket.details?.error || "ExpoError",
            message: ticket.message || "",
          });
        }
      });
    } catch (err) {
      // Batch failed — mark all in batch as failed
      for (const item of batchTokens) {
        results.push({
          token: item.expoPushToken,
          status: "error",
          ticketId: null,
          error: "NetworkError",
          message: err.message,
        });
      }
    }
  }

  return results;
}

module.exports = { sendNotifications, getReceipts, isValidExpoPushToken };
