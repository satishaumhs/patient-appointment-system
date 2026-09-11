const { body, param } = require("express-validator");

const phoneValidator = (field) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .customSanitizer((value) => value.replace(/\D/g, ""))
    .isLength({ min: 10, max: 10 })
    .withMessage("Enter a valid 10-digit mobile number");

const createAppointmentValidator = [
  body("slotId").isMongoId().withMessage("A valid slot id is required"),
  body("reason").optional({ checkFalsy: true }).trim(),
  body("appointmentType").optional().isIn(["in-person", "video"]).withMessage("Invalid appointment type"),
  body("patientInfo.name").trim().notEmpty().withMessage("Patient name is required"),
  body("patientInfo.age").isInt({ min: 0, max: 120 }).withMessage("Enter a valid age"),
  body("patientInfo.gender").isIn(["male", "female", "other"]).withMessage("Select a gender"),
  phoneValidator("patientInfo.phone"),
  body("patientInfo.email").optional({ checkFalsy: true }).isEmail().withMessage("Enter a valid email").normalizeEmail(),
  body("patientInfo.city").optional({ checkFalsy: true }).trim(),
];

const updateStatusValidator = [
  body("status")
    .isIn(["pending", "confirmed", "rejected", "cancelled", "completed"])
    .withMessage("Invalid status"),
];

const rescheduleValidator = [body("newSlotId").isMongoId().withMessage("A valid slot id is required")];

const statusLookupValidator = [
  param("referenceNumber").matches(/^MHS-\d{5}$/).withMessage("Invalid reference number"),
  phoneValidator("phone"),
];

const payValidator = [
  param("referenceNumber").matches(/^MHS-\d{5}$/).withMessage("Invalid reference number"),
  phoneValidator("phone"),
  body("method").optional().isIn(["card", "upi"]).withMessage("Invalid payment method"),
];

const reviewValidator = [
  param("referenceNumber").matches(/^MHS-\d{5}$/).withMessage("Invalid reference number"),
  phoneValidator("phone"),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment").optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage("Comment is too long"),
];

module.exports = {
  createAppointmentValidator,
  updateStatusValidator,
  rescheduleValidator,
  statusLookupValidator,
  payValidator,
  reviewValidator,
};
