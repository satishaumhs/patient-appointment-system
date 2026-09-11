const mongoose = require("mongoose");

// A real, working "notifications" feature without a third-party email/SMS
// provider wired up (that needs real credentials nobody has supplied): this
// IS the notification -- surfaced in-app via the doctor's notification bell,
// and via a timeline on the patient's public status-lookup page -- not a
// placeholder for one. See utils/notify.js for where these get created.
const notificationSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },

    audience: {
      type: String,
      enum: ["doctor", "patient"],
      required: true,
    },

    // Only set for audience: "doctor" -- lets the bell query by recipient
    // without populating through appointment -> doctor on every request.
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    event: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ doctor: 1, createdAt: -1 });
notificationSchema.index({ appointment: 1, audience: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
