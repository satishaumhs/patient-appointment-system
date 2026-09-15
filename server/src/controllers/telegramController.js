const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const { sendTelegramMessage, answerCallbackQuery } = require("../utils/telegramBot");
const { applyStatusChange, doctorLabel } = require("./appointmentController");

const CONNECT_TOKEN_TTL_MS = 10 * 60 * 1000;
const PREFERENCE_KEYS = ["notifyNewRequest", "notifyStatusChange", "notifyPayment"];

// Doctor-only: a fresh one-time link each time it's requested, same
// hashed-random-token pattern authController.js uses for password resets --
// not a JWT, because Telegram's deep-link `start` parameter is capped at 64
// characters and a JWT won't fit, but a 64-char hex token does.
//
// This -- and every other write below -- uses $set/$unset via
// findByIdAndUpdate rather than "load, mutate a field, markModified, save".
// telegram.chatId is select:false, so a load that doesn't ask for it (every
// load except one that's deliberately reading it) comes back with that key
// simply absent from the in-memory subdocument; markModified("telegram")
// then has Mongoose re-serialize the *whole* nested object on save, which
// silently overwrites the stored document with a chatId-less version and
// disconnects the doctor as a side effect of e.g. flipping a notification
// preference. A targeted dot-path update never reads or rewrites sibling
// fields, so it can't lose one it never touched.
const getConnectLink = asyncHandler(async (req, res) => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      "telegram.pendingConnectToken": crypto.createHash("sha256").update(rawToken).digest("hex"),
      "telegram.pendingConnectExpires": new Date(Date.now() + CONNECT_TOKEN_TTL_MS),
    },
  });

  res.json({
    url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${rawToken}`,
    expiresInMinutes: CONNECT_TOKEN_TTL_MS / 60000,
  });
});

const getStatus = asyncHandler(async (req, res) => {
  const doctor = await User.findById(req.user._id).select("+telegram.chatId");

  res.json({
    connected: Boolean(doctor.telegram?.chatId),
    linkedAt: doctor.telegram?.linkedAt || null,
    preferences: {
      notifyNewRequest: doctor.telegram?.notifyNewRequest ?? true,
      notifyStatusChange: doctor.telegram?.notifyStatusChange ?? true,
      notifyPayment: doctor.telegram?.notifyPayment ?? true,
    },
  });
});

const disconnect = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { "telegram.chatId": "", "telegram.linkedAt": "" } });
  res.json({ message: "Telegram disconnected" });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const updates = {};
  PREFERENCE_KEYS.forEach((key) => {
    if (typeof req.body[key] === "boolean") {
      updates[`telegram.${key}`] = req.body[key];
    }
  });

  const doctor = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: "after" });

  res.json({
    notifyNewRequest: doctor.telegram.notifyNewRequest,
    notifyStatusChange: doctor.telegram.notifyStatusChange,
    notifyPayment: doctor.telegram.notifyPayment,
  });
});

// A brand new chat with the bot, or an existing one sending /start again --
// either way this is how a Telegram chat gets linked to a doctor account.
const handleStart = async (message) => {
  const chatId = String(message.chat.id);
  const rawToken = message.text.split(" ")[1];

  if (!rawToken) {
    await sendTelegramMessage(
      chatId,
      "Hi! Open the connect link from your My Health School profile to link this chat to your doctor account."
    );
    return;
  }

  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const doctor = await User.findOneAndUpdate(
    {
      "telegram.pendingConnectToken": hashedToken,
      "telegram.pendingConnectExpires": { $gt: new Date() },
    },
    {
      $set: { "telegram.chatId": chatId, "telegram.linkedAt": new Date() },
      $unset: { "telegram.pendingConnectToken": "", "telegram.pendingConnectExpires": "" },
    }
  );

  if (!doctor) {
    await sendTelegramMessage(
      chatId,
      "This connection link has expired. Generate a new one from your profile and try again."
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `You're connected, ${doctorLabel(doctor.name)}. New appointment requests will show up here with Accept/Reject buttons.`
  );
};

const STATUS_BY_ACTION = { acc: "confirmed", rej: "rejected" };

// A tap on an Accept/Reject button. Runs through the exact same
// applyStatusChange() the REST endpoint uses, so a doctor acting from
// Telegram can never end up with different rules than acting from the app.
const handleCallbackQuery = async (callbackQuery) => {
  const [action, appointmentId] = (callbackQuery.data || "").split(":");
  const chatId = String(callbackQuery.message?.chat?.id || "");
  const status = STATUS_BY_ACTION[action];

  if (!status || !appointmentId) {
    await answerCallbackQuery(callbackQuery.id, "Unrecognized action");
    return;
  }

  const doctor = await User.findOne({ "telegram.chatId": chatId }).select("+telegram.chatId");
  const appointment =
    doctor && (await Appointment.findById(appointmentId).populate("doctor", "name email"));

  if (!doctor || !appointment || !appointment.doctor._id.equals(doctor._id)) {
    await answerCallbackQuery(callbackQuery.id, "This request isn't linked to your account");
    return;
  }

  const result = await applyStatusChange({
    appointment,
    actingUserId: doctor._id,
    actingUserRole: "doctor",
    status,
  });

  if (result.error) {
    await answerCallbackQuery(callbackQuery.id, result.error.message);
    return;
  }

  await answerCallbackQuery(callbackQuery.id, status === "confirmed" ? "Accepted" : "Rejected");
  await sendTelegramMessage(
    chatId,
    `${status === "confirmed" ? "✅ Accepted" : "❌ Rejected"}: ${appointment.patientInfo.name} on ${appointment.date.toLocaleString()}.`
  );
};

// Public, secret-header-gated (see verifyTelegramSecret in telegramRoutes.js).
// Processing here is a couple of local DB queries, not a slow external call,
// so it's awaited before responding rather than fired-and-forgotten -- and
// errors are swallowed rather than propagated: a malformed/unrecognized
// update is something we'll never successfully process, so letting Telegram
// retry it wouldn't help, and Express's default error handler would leak a
// stack trace to a caller we can't actually authenticate beyond the shared
// secret.
const handleWebhook = asyncHandler(async (req, res) => {
  try {
    const update = req.body;
    if (update.message?.text?.startsWith("/start")) {
      await handleStart(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (error) {
    console.error("[Telegram webhook] failed to process update:", error.message);
  }

  res.sendStatus(200);
});

module.exports = { getConnectLink, getStatus, disconnect, updatePreferences, handleWebhook };
