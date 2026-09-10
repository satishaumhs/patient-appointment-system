const express = require("express");
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  getAppointmentByReference,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
} = require("../controllers/appointmentController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { publicAppointmentLimiter } = require("../middleware/rateLimiters");
const validateRequest = require("../middleware/validateRequest");
const {
  createAppointmentValidator,
  updateStatusValidator,
  rescheduleValidator,
  statusLookupValidator,
} = require("../validators/appointmentValidators");

const router = express.Router();

// Public: no account exists for patients, so booking and status lookup can't
// require a session.
router.post("/", publicAppointmentLimiter, createAppointmentValidator, validateRequest, createAppointment);
router.post(
  "/status/:referenceNumber",
  publicAppointmentLimiter,
  statusLookupValidator,
  validateRequest,
  getAppointmentByReference
);

router.get("/", protect, getAppointments);
router.get("/:id", protect, getAppointmentById);
router.patch("/:id/status", protect, updateStatusValidator, validateRequest, updateAppointmentStatus);
router.patch("/:id/reschedule", protect, authorize("doctor"), rescheduleValidator, validateRequest, rescheduleAppointment);
router.delete("/:id", protect, authorize("admin"), deleteAppointment);

module.exports = router;
