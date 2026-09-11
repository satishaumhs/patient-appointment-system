const express = require("express");
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorize("doctor"), getMyNotifications);

// NOTE: "/read-all" must stay registered before the "/:id/read" wildcard
// below, same route-ordering hazard as availability's "/mine" vs
// "/:doctorId" -- otherwise it would match :id="read-all" first and fail to
// cast as an ObjectId.
router.patch("/read-all", protect, authorize("doctor"), markAllNotificationsRead);
router.patch("/:id/read", protect, authorize("doctor"), markNotificationRead);

module.exports = router;
