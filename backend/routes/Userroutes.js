const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();

router.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    const existinguser = await User.findOne({ email });
    if (existinguser)
      return res.status(404).json({ message: "User already exisits" });
    const hashedpassword = await bcrypt.hash(password, 10);
    const user = new User({
      fullName,
      email,
      password: hashedpassword,
    });
    await user.save();
    const { password: _, ...userData } = user.toObject();
    res.status(201).json({ user: userData });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    const ismatch = await bcrypt.compare(password, user.password);
    if (!ismatch) return res.status(404).json({ message: "Invalid password" });

    const { password: _, ...userData } = user.toObject();
    res.status(201).json({ user: userData });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /user/theme/:userId - Fetch theme preference for user
router.get("/theme/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId).select("themePreference");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ themePreference: user.themePreference || "system" });
  } catch (error) {
    console.log("GET /user/theme error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// PATCH /user/theme - Update theme preference
router.patch("/theme", async (req, res) => {
  const { userId, themePreference } = req.body;
  try {
    if (!userId) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const ALLOWED_THEMES = ["system", "light", "dark"];
    if (!themePreference || !ALLOWED_THEMES.includes(themePreference)) {
      return res.status(400).json({
        message: `Invalid themePreference: ${themePreference}. Must be one of: ${ALLOWED_THEMES.join(", ")}`,
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { themePreference },
      { new: true }
    ).select("themePreference");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Theme preference updated",
      themePreference: user.themePreference,
    });
  } catch (error) {
    console.log("PATCH /user/theme error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;