const { body } = require("express-validator");

const generateSlotsValidator = [
  body("date").isISO8601().withMessage("A valid date is required"),
  body("startTime")
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage("startTime must be in HH:mm format"),
  body("endTime")
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage("endTime must be in HH:mm format"),
  body("slotMinutes")
    .isInt({ min: 5, max: 240 })
    .withMessage("slotMinutes must be between 5 and 240"),
];

module.exports = { generateSlotsValidator };
