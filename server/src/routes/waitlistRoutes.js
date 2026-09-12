const express = require("express");
const { joinWaitlist, getMyWaitlist, getAllWaitlist, leaveWaitlist } = require("../controllers/waitlistController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { publicAppointmentLimiter } = require("../middleware/rateLimiters");
const validateRequest = require("../middleware/validateRequest");
const { joinWaitlistValidator, leaveWaitlistValidator } = require("../validators/waitlistValidators");

const router = express.Router();

// Public: joining a waitlist needs no more identity than booking itself does.
router.post("/", publicAppointmentLimiter, joinWaitlistValidator, validateRequest, joinWaitlist);

router.get("/mine", protect, authorize("doctor"), getMyWaitlist);

router.get("/", protect, authorize("admin"), getAllWaitlist);

// Public, phone-gated -- rate limited since it's an unauthenticated lookup
// keyed on a guessable code, same pattern as the appointment status lookup.
router.delete("/:waitlistCode", publicAppointmentLimiter, leaveWaitlistValidator, validateRequest, leaveWaitlist);

module.exports = router;
