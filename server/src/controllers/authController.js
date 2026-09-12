const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const registerUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    specialization,
    location,
    consultationType,
    bio,
    experience,
    qualification,
    consultationFee,
  } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Only doctors self-register now (admin is DB-only); every field below applies.
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "doctor",
    specialization,
    location,
    consultationType,
    bio,
    experience,
    qualification,
    consultationFee,
  });

  generateToken(res, user._id);

  res.status(201).json({
    message: "User registered successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  generateToken(res, user._id);

  res.status(200).json({
    message: "Login successful",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const logoutUser = (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("token", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    expires: new Date(0),
  });

  res.status(200).json({ message: "Logged out successfully" });
};

const getMe = (req, res) => {
  res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

// Public. Same response whether or not the email is registered -- avoids
// confirming which emails have accounts, the same reasoning already applied
// to the appointment reference-number lookup elsewhere in this app.
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  const genericMessage = "If an account exists for that email, a reset link has been generated.";

  if (!user) {
    return res.json({ message: genericMessage });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;

  // No email provider is configured (same constraint as the rest of this
  // app's notifications) -- logged as a demo email AND returned directly in
  // the response so the flow is actually completable. A real deployment with
  // a mail provider would drop demoResetLink from the response entirely and
  // only ever deliver the link by email.
  console.log(`[DEMO EMAIL] to ${user.email}: Reset your password -- ${resetLink}`);

  res.json({ message: genericMessage, demoResetLink: resetLink });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "This reset link is invalid or has expired" });
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successfully. You can now log in." });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
};
