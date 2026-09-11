const express = require("express");
const {
  generateSlots,
  getAvailableSlots,
  getMySlots,
  deleteSlot,
  blockSlot,
  unblockSlot,
} = require("../controllers/availabilityController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { generateSlotsValidator, blockSlotValidator } = require("../validators/availabilityValidators");

const router = express.Router();

router.post("/", protect, authorize("doctor"), generateSlotsValidator, validateRequest, generateSlots);

// NOTE: "/mine" must stay registered before the "/:doctorId" wildcard below --
// otherwise a request to /availability/mine would match :doctorId="mine"
// first (a public route), throw a CastError casting "mine" to an ObjectId,
// and this doctor-only endpoint would incorrectly 404.
router.get("/mine", protect, authorize("doctor"), getMySlots);

// Public: anonymous patients need to see open slots before booking.
router.get("/:doctorId", getAvailableSlots);

router.delete("/:id", protect, authorize("doctor"), deleteSlot);
router.patch("/:id/block", protect, authorize("doctor"), blockSlotValidator, validateRequest, blockSlot);
router.patch("/:id/unblock", protect, authorize("doctor"), unblockSlot);

module.exports = router;
