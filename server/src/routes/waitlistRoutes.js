const express = require("express");
const { joinWaitlist, getMyWaitlist } = require("../controllers/waitlistController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { publicAppointmentLimiter } = require("../middleware/rateLimiters");
const validateRequest = require("../middleware/validateRequest");
const { joinWaitlistValidator } = require("../validators/waitlistValidators");

const router = express.Router();

// Public: joining a waitlist needs no more identity than booking itself does.
router.post("/", publicAppointmentLimiter, joinWaitlistValidator, validateRequest, joinWaitlist);

router.get("/mine", protect, authorize("doctor"), getMyWaitlist);

module.exports = router;
