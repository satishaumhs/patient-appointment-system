const mongoose = require("mongoose");

// Pull-based by design: there's no verified push channel (no SMS/WhatsApp
// provider configured), so "notified" means a demo email log fired (if an
// email was given) and the entry flips to notified -- the patient's real
// confirmation is just revisiting the doctor's profile page, where
// hasAvailability now reflects the slot that opened up.
const waitlistSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    waitlistCode: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["waiting", "notified"],
      default: "waiting",
    },
    notifiedAt: Date,
  },
  {
    timestamps: true,
  }
);

waitlistSchema.index({ doctor: 1, status: 1 });

module.exports = mongoose.model("Waitlist", waitlistSchema);
