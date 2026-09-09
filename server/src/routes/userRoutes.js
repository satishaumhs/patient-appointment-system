const express = require("express");
const { getDoctors } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/doctors", protect, getDoctors);

module.exports = router;
