const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    // No account/login exists for patients -- this is a snapshot of who asked
    // for the appointment, captured at booking time. The reference number
    // (below) plus phone is how a patient looks their own request back up.
    patientInfo: {
      name: { type: String, required: true, trim: true },
      age: { type: Number, required: true, min: 0, max: 120 },
      gender: { type: String, required: true, enum: ["male", "female", "other"] },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
      city: { type: String, trim: true },
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Availability",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
    },

    appointmentType: {
      type: String,
      enum: ["in-person", "video"],
      default: "in-person",
    },

    referenceNumber: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected", "cancelled", "completed"],
      default: "pending",
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({ "patientInfo.phone": 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
