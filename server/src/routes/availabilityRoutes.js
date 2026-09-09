const express = require("express");
const {
  generateSlots,
  getAvailableSlots,
  getMySlots,
  deleteSlot,
} = require("../controllers/availabilityController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { generateSlotsValidator } = require("../validators/availabilityValidators");

const router = express.Router();

router.use(protect);

router.post("/", authorize("doctor"), generateSlotsValidator, validateRequest, generateSlots);
router.get("/mine", authorize("doctor"), getMySlots);
router.get("/:doctorId", getAvailableSlots);
router.delete("/:id", authorize("doctor"), deleteSlot);

module.exports = router;
