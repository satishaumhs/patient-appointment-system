const { body } = require("express-validator");

const createAppointmentValidator = [
  body("slotId").isMongoId().withMessage("A valid slot id is required"),
  body("reason").trim().notEmpty().withMessage("Reason is required"),
];

const updateStatusValidator = [
  body("status")
    .isIn(["pending", "confirmed", "cancelled", "completed"])
    .withMessage("Invalid status"),
];

module.exports = { createAppointmentValidator, updateStatusValidator };
