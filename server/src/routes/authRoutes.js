const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require("../validators/authValidators");

const router = express.Router();

router.post("/register", registerValidator, validateRequest, registerUser);
router.post("/login", loginValidator, validateRequest, loginUser);
router.post("/logout", logoutUser);
router.get("/me", protect, getMe);
router.post("/forgot-password", forgotPasswordValidator, validateRequest, forgotPassword);
router.post("/reset-password/:token", resetPasswordValidator, validateRequest, resetPassword);

module.exports = router;
