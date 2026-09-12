const { body } = require("express-validator");

const updateProfileValidator = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("specialization").optional().trim().notEmpty().withMessage("Specialization cannot be empty"),
  body("location").optional().trim(),
  body("consultationType").optional().isIn(["in-person", "video", "both"]).withMessage("Invalid consultation type"),
  body("bio").optional().trim(),
  body("experience")
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 80 })
    .withMessage("Experience must be a whole number of years"),
  body("qualification").optional().trim(),
  body("consultationFee")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Consultation fee must be a positive number"),
];

module.exports = { updateProfileValidator };
