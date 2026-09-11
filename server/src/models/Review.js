const mongoose = require("mongoose");

// Reviews only ever come from the public /status page's "Rate your visit"
// form, gated to appointments that are actually status: "completed" -- see
// appointmentController.submitReview. Nothing in the app auto-generates one.
const reviewSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Snapshotted from patientInfo.name at review time -- there's no patient
    // account to join back to later.
    patientName: {
      type: String,
      required: true,
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
