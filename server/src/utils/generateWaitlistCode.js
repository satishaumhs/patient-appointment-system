const Waitlist = require("../models/Waitlist");

// Format: WL-XXXXX -- same shape and collision-retry idiom as
// generateReferenceNumber.js, but prefixed distinctly so a patient never
// confuses a waitlist code with a real appointment reference number.
const MAX_ATTEMPTS = 10;

const generateWaitlistCode = async () => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `WL-${Math.floor(10000 + Math.random() * 90000)}`;
    const exists = await Waitlist.exists({ waitlistCode: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate a unique waitlist code");
};

module.exports = generateWaitlistCode;
