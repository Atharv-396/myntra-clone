const mongoose = require("mongoose");

const PushDeviceSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expoPushToken: { type: String, required: true },
    deviceId:      { type: String, required: true },
    platform:      { type: String, enum: ["android", "ios", "web"], default: "android" },
    appVersion:    { type: String, default: "" },
    isActive:      { type: Boolean, default: true },
    lastUsedAt:    { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for efficient lookups
PushDeviceSchema.index({ userId: 1 });
PushDeviceSchema.index({ expoPushToken: 1 });
PushDeviceSchema.index({ deviceId: 1 });
PushDeviceSchema.index({ isActive: 1 });
// Unique: one active registration per user+device combination
PushDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model("PushDevice", PushDeviceSchema);
