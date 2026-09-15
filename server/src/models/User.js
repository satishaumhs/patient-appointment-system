const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["doctor", "admin"],
      default: "doctor",
    },

    // Doctor-only profile fields (unused for admin accounts).
    specialization: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    consultationType: {
      type: String,
      enum: ["in-person", "video", "both"],
      default: "in-person",
    },
    bio: {
      type: String,
      trim: true,
    },
    experience: {
      type: Number,
      min: 0,
    },
    qualification: {
      type: String,
      trim: true,
    },
    consultationFee: {
      type: Number,
      min: 0,
    },

    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    // Doctor-only. chatId is effectively a credential (whoever holds it can
    // message this doctor's linked Telegram chat), so it's select:false the
    // same way resetPasswordToken is -- never returned unless a query
    // explicitly asks for it. The preferences default to on so a doctor who
    // just connected starts receiving everything, then can dial it back.
    //
    // pendingConnectToken/Expires use the exact same hashed-random-token
    // pattern as resetPasswordToken/Expires above -- not a JWT, because
    // Telegram's deep-link `start` parameter is capped at 64 characters and
    // a JWT won't fit; a 64-char hex token (32 random bytes) does.
    telegram: {
      chatId: { type: String, select: false },
      linkedAt: Date,
      notifyNewRequest: { type: Boolean, default: true },
      notifyStatusChange: { type: Boolean, default: true },
      notifyPayment: { type: Boolean, default: true },
      pendingConnectToken: { type: String, select: false },
      pendingConnectExpires: { type: Date, select: false },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);