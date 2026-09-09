const { body } = require("express-validator");

const createAppointmentValidator = [
  body("doctor").isMongoId().withMessage("A valid doctor id is required"),
  body("date").isISO8601().withMessage("A valid date is required"),
  body("reason").trim().notEmpty().withMessage("Reason is required"),
];

const updateStatusValidator = [
  body("status")
    .isIn(["pending", "confirmed", "cancelled", "completed"])
    .withMessage("Invalid status"),
];

module.exports = { createAppointmentValidator, updateStatusValidator };
