const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getConnectLink,
  getConnectLinkForDoctor,
  getStatus,
  disconnect,
  updatePreferences,
  handleWebhook,
} = require("../controllers/telegramController");

const router = express.Router();

// Telegram's own servers call this -- verified by a secret only Telegram and
// this server know (set at registration time via setWebhook), not a login.
// A missing/wrong header is rejected before touching the DB or the bot API.
const verifyTelegramSecret = (req, res, next) => {
  if (req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  next();
};

router.get("/connect-link", protect, authorize("doctor"), getConnectLink);
router.get("/connect-link/:doctorId", protect, authorize("admin"), getConnectLinkForDoctor);
router.get("/status", protect, authorize("doctor"), getStatus);
router.delete("/connect", protect, authorize("doctor"), disconnect);
router.patch("/preferences", protect, authorize("doctor"), updatePreferences);

router.post("/webhook", verifyTelegramSecret, handleWebhook);

module.exports = router;
