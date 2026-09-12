const { body } = require("express-validator");

const phoneValidator = (field) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .customSanitizer((value) => value.replace(/\D/g, ""))
    .isLength({ min: 10, max: 10 })
    .withMessage("Enter a valid 10-digit mobile number");

const joinWaitlistValidator = [
  body("doctorId").isMongoId().withMessage("A valid doctor id is required"),
  body("name").trim().notEmpty().withMessage("Name is required"),
  phoneValidator("phone"),
  body("email").optional({ checkFalsy: true }).isEmail().withMessage("Enter a valid email").normalizeEmail(),
];

const leaveWaitlistValidator = [phoneValidator("phone")];

module.exports = { joinWaitlistValidator, leaveWaitlistValidator };
