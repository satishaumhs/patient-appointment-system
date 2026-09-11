const express = require("express");
const { getDoctors, getDoctorById, getDoctorReviews, getUsers, deleteUser } = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Public: anonymous patients need to browse doctors before booking.
router.get("/doctors", getDoctors);
router.get("/doctors/:id", getDoctorById);
router.get("/doctors/:id/reviews", getDoctorReviews);

router.get("/", protect, authorize("admin"), getUsers);
router.delete("/:id", protect, authorize("admin"), deleteUser);

module.exports = router;
