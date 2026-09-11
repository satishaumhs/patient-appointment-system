const { body, param } = require("express-validator");

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
  body("repeatUntil").optional({ checkFalsy: true }).isISO8601().withMessage("repeatUntil must be a valid date"),
  body("repeatOn").optional().isArray().withMessage("repeatOn must be an array of weekday numbers"),
  body("repeatOn.*").optional().isInt({ min: 0, max: 6 }).withMessage("repeatOn values must be 0-6"),
];

const blockSlotValidator = [
  param("id").isMongoId().withMessage("A valid slot id is required"),
  body("reason").isIn(["meeting", "break", "personal", "other"]).withMessage("Invalid block reason"),
];

module.exports = { generateSlotsValidator, blockSlotValidator };
