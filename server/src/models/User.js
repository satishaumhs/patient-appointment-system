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
      enum: ["patient", "doctor", "admin"],
      default: "patient",
    },

    // Doctor-only profile fields (unused for patient/admin accounts).
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);