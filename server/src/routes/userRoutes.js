const express = require("express");
const {
  getDoctors,
  getDoctorById,
  getDoctorReviews,
  updateMyProfile,
  getUsers,
  deleteUser,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { updateProfileValidator } = require("../validators/userValidators");

const router = express.Router();

// Public: anonymous patients need to browse doctors before booking.
router.get("/doctors", getDoctors);
router.get("/doctors/:id", getDoctorById);
router.get("/doctors/:id/reviews", getDoctorReviews);

router.patch("/me", protect, authorize("doctor"), updateProfileValidator, validateRequest, updateMyProfile);

router.get("/", protect, authorize("admin"), getUsers);
router.delete("/:id", protect, authorize("admin"), deleteUser);

module.exports = router;
