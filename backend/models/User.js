const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    themePreference: {
      type: String,
      enum: ["system", "light", "dark"],
      default: "system",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
