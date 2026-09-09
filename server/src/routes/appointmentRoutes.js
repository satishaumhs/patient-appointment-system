const express = require("express");
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
} = require("../controllers/appointmentController");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  createAppointmentValidator,
  updateStatusValidator,
} = require("../validators/appointmentValidators");

const router = express.Router();

router.use(protect);

router.post("/", authorize("patient"), createAppointmentValidator, validateRequest, createAppointment);
router.get("/", getAppointments);
router.get("/:id", getAppointmentById);
router.patch("/:id/status", updateStatusValidator, validateRequest, updateAppointmentStatus);
router.delete("/:id", authorize("admin"), deleteAppointment);

module.exports = router;
