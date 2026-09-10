const Appointment = require("../models/Appointment");

// Format: MHS-XXXXX (5 random digits). Retries on a unique-index collision
// using the same error.code === 11000 idiom the rest of this codebase already
// uses for duplicate-key handling (see availabilityController.generateSlots).
const MAX_ATTEMPTS = 10;

const generateReferenceNumber = async () => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `MHS-${Math.floor(10000 + Math.random() * 90000)}`;
    const exists = await Appointment.exists({ referenceNumber: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate a unique reference number");
};

module.exports = generateReferenceNumber;
