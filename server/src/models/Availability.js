const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    isBooked: {
      type: Boolean,
      default: false,
    },

    // A blocked slot is also isBooked:true (so it's excluded from booking the
    // same way a real appointment would be, and can't be double-claimed) --
    // this field is what distinguishes "doctor blocked this time" from "a
    // patient booked this time" for display and for allowing the doctor to
    // free it back up (unlike a real booking, which can't be freely deleted).
    blockedReason: {
      type: String,
      enum: ["meeting", "break", "personal", "other"],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

availabilitySchema.index({ doctor: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model("Availability", availabilitySchema);
