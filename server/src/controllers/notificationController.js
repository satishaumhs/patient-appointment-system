const asyncHandler = require("../utils/asyncHandler");
const Notification = require("../models/Notification");

const getMyNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ audience: "doctor", doctor: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ audience: "doctor", doctor: req.user._id, read: false }),
  ]);

  res.json({ notifications, unreadCount });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, doctor: req.user._id },
    { read: true },
    { returnDocument: "after" }
  );

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.json(notification);
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ audience: "doctor", doctor: req.user._id, read: false }, { read: true });
  res.json({ message: "All notifications marked as read" });
});

module.exports = { getMyNotifications, markNotificationRead, markAllNotificationsRead };
