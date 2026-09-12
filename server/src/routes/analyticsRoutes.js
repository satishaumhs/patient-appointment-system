const express = require("express");
const { getAdminAnalytics } = require("../controllers/analyticsController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("admin"), getAdminAnalytics);

module.exports = router;
