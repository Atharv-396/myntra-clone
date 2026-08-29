const dotenv = require("dotenv");
dotenv.config(); // must be first — loads .env before anything else reads process.env

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]); // force Google DNS (fixes local DNS proxy blocking MongoDB SRV)

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");

const userrouter = require("./routes/Userroutes");
const categoryrouter = require("./routes/Categoryroutes");
const productrouter = require("./routes/Productroutes");
const Bagroutes = require("./routes/Bagroutes");
const Wishlistroutes = require("./routes/Wishlistroutes");
const OrderRoutes = require("./routes/OrderRoutes");
const RecentlyViewedRoutes = require("./routes/RecentlyViewedRoutes");
const RecommendationRoutes = require("./routes/RecommendationRoutes");
const NotificationRoutes = require("./routes/NotificationRoutes");
const PaymentRoutes = require("./routes/PaymentRoutes");
const NotificationPreference = require("./models/NotificationPreference");
const { processReceipts, scanAbandonedCarts } = require("./services/notificationService");

const ALL_PREF_DEFAULTS = {
  orderNotifications: true,
  paymentNotifications: true,
  shippingNotifications: true,
  deliveryNotifications: true,
  wishlistNotifications: true,
  stockNotifications: true,
  promotionNotifications: true,
  cartNotifications: true,
};

async function backfillNotificationPreferences() {
  try {
    console.log("[Migration] Checking NotificationPreference docs for missing fields...");
    const allDocs = await NotificationPreference.find({}).lean();
    if (allDocs.length === 0) {
      console.log("[Migration] No NotificationPreference docs found — nothing to backfill.");
      return;
    }

    let patched = 0;
    for (const doc of allDocs) {
      const $set = {};
      for (const [field, defaultVal] of Object.entries(ALL_PREF_DEFAULTS)) {
        if (doc[field] === undefined || doc[field] === null) {
          $set[field] = defaultVal;
        }
      }
      if (Object.keys($set).length > 0) {
        await NotificationPreference.updateOne({ _id: doc._id }, { $set });
        patched++;
      }
    }
    console.log(`[Migration] Backfilled ${patched}/${allDocs.length} NotificationPreference docs.`);
  } catch (err) {
    console.log("[Migration] backfillNotificationPreferences error:", err.message);
  }
}

const app = express();
app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

app.get("/", (req, res) => {
  res.send("Myntra backend is working");
});

app.use("/user", userrouter);
app.use("/category", categoryrouter);
app.use("/product", productrouter);
app.use("/bag", Bagroutes);
app.use("/wishlist", Wishlistroutes);
app.use("/order", OrderRoutes);
app.use("/recently-viewed", RecentlyViewedRoutes);
app.use("/recommendations", RecommendationRoutes);
app.use("/api/notifications", NotificationRoutes);
app.use("/payment", PaymentRoutes);

function startBackgroundJobs() {
  const abandonedCartCron = process.env.NOTIFICATION_ABANDONED_CART_CRON || "*/30 * * * *";
  const abandonedAfterHours = Number(process.env.NOTIFICATION_ABANDONED_AFTER_HOURS) || 1;
  const receiptCron = process.env.NOTIFICATION_RECEIPT_CRON || "*/5 * * * *";

  try {
    cron.schedule(abandonedCartCron, async () => {
      console.log("[Scheduler] Running abandoned cart scan...");
      try {
        const result = await scanAbandonedCarts({ abandonedAfterHours });
        console.log("[Scheduler] Abandoned cart scan:", JSON.stringify(result));
      } catch (err) {
        console.log("[Scheduler] scanAbandonedCarts error:", err.message);
      }
    });
    console.log(`[Scheduler] Abandoned cart job scheduled: ${abandonedCartCron}`);
  } catch (err) {
    console.log("[Scheduler] Failed to schedule abandoned cart job:", err.message);
  }

  try {
    cron.schedule(receiptCron, async () => {
      try {
        await processReceipts();
      } catch (err) {
        console.log("[Scheduler] processReceipts error:", err.message);
      }
    });
    console.log(`[Scheduler] Receipt job scheduled: ${receiptCron}`);
  } catch (err) {
    console.log("[Scheduler] Failed to schedule receipt job:", err.message);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await backfillNotificationPreferences();
    startBackgroundJobs();
  })
  .catch((err) => console.log("MongoDB connection error:", err.message));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
