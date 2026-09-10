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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);