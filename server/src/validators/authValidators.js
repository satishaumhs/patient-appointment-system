const { body } = require("express-validator");

const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  // Admin is intentionally excluded: self-registration must never grant admin.
  // Promote a user to admin directly in the database.
  body("role")
    .optional()
    .isIn(["patient", "doctor"])
    .withMessage("Invalid role"),
  body("specialization")
    .if(body("role").equals("doctor"))
    .trim()
    .notEmpty()
    .withMessage("Specialization is required for doctor accounts"),
  body("location").optional().trim(),
  body("consultationType").optional().isIn(["in-person", "video", "both"]).withMessage("Invalid consultation type"),
  body("bio").optional().trim(),
  body("experience").optional({ checkFalsy: true }).isInt({ min: 0, max: 80 }).withMessage("Experience must be a whole number of years"),
  body("qualification").optional().trim(),
  body("consultationFee").optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage("Consultation fee must be a positive number"),
];

const loginValidator = [
  body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

module.exports = { registerValidator, loginValidator };
