const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const { sendTelegramMessage, answerCallbackQuery, clearMessageButtons } = require("../utils/telegramBot");
const doctorLabel = require("../utils/doctorLabel");
const formatClinicDateTime = require("../utils/formatClinicDateTime");
const { applyStatusChange, applyReschedule, TERMINAL_STATUSES } = require("./appointmentController");

const CONNECT_TOKEN_TTL_MS = 10 * 60 * 1000;
const PREFERENCE_KEYS = ["notifyNewRequest", "notifyStatusChange", "notifyPayment"];
const MAX_RESCHEDULE_OPTIONS = 8;

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

// Shared by every button handler below: resolve the tapping chat to a
// linked doctor, load the appointment the button refers to, and confirm
// that appointment is actually this doctor's -- the one check that stops a
// stale or tampered callback_data from acting on someone else's request.
//
// One chat can be linked to more than one doctor account (e.g. a front desk
// managing several doctors), so this has to check every doctor linked to
// the chat for a match, not just whichever one findOne happens to return
// first -- that was returning an arbitrary doctor and failing the ownership
// check even when the right one really was connected.
const findLinkedDoctorAndAppointment = async (chatId, appointmentId) => {
  const appointment = await Appointment.findById(appointmentId).populate("doctor", "name email");
  if (!appointment) return {};

  const linkedDoctors = await User.find({ "telegram.chatId": chatId }).select("+telegram.chatId");
  const doctor = linkedDoctors.find((d) => d._id.equals(appointment.doctor._id));

  if (!doctor) return {};
  return { doctor, appointment };
};

// A tap on an Accept/Reject button. Runs through the exact same
// applyStatusChange() the REST endpoint uses, so a doctor acting from
// Telegram can never end up with different rules than acting from the app.
const handleAcceptReject = async (callbackQuery, chatId, action, appointmentId) => {
  const status = STATUS_BY_ACTION[action];
  const { doctor, appointment } = await findLinkedDoctorAndAppointment(chatId, appointmentId);

  if (!doctor || !appointment) {
    await answerCallbackQuery(callbackQuery.id, "This request isn't linked to your account");
    return;
  }

  const result = await applyStatusChange({ appointment, actingUserId: doctor._id, actingUserRole: "doctor", status });

  // Every possible error here (terminal status, scheduled time already
  // passed) is deterministic -- tapping the same button again can't ever
  // succeed, so the buttons come off on error too, not just on success.
  if (result.error) {
    await answerCallbackQuery(callbackQuery.id, result.error.message);
    await clearMessageButtons(chatId, callbackQuery.message.message_id);
    return;
  }

  await answerCallbackQuery(callbackQuery.id, status === "confirmed" ? "Accepted" : "Rejected");
  await clearMessageButtons(chatId, callbackQuery.message.message_id);
  await sendTelegramMessage(
    chatId,
    `${status === "confirmed" ? "✅ Accepted" : "❌ Rejected"} — ${doctorLabel(appointment.doctor.name)}: ${appointment.patientInfo.name} on ${formatClinicDateTime(appointment.date)}.`
  );
};

// A tap on "Reschedule": offers the doctor's own next open slots as buttons,
// rather than trying to recreate the app's full calendar picker inside a
// chat. Each option carries the slot id directly in its callback_data, so
// picking one is a single round trip instead of a multi-step conversation
// Telegram has no server-side state to track between taps anyway.
const handleReschedulePrompt = async (callbackQuery, chatId, appointmentId) => {
  const { doctor, appointment } = await findLinkedDoctorAndAppointment(chatId, appointmentId);

  if (!doctor || !appointment) {
    await answerCallbackQuery(callbackQuery.id, "This request isn't linked to your account");
    return;
  }

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    await answerCallbackQuery(callbackQuery.id, `Cannot reschedule a ${appointment.status} appointment`);
    await clearMessageButtons(chatId, callbackQuery.message.message_id);
    return;
  }

  const openSlots = await Availability.find({
    doctor: appointment.doctor._id,
    isBooked: false,
    startTime: { $gt: new Date() },
  })
    .sort({ startTime: 1 })
    .limit(MAX_RESCHEDULE_OPTIONS);

  await answerCallbackQuery(callbackQuery.id, "Pick a new time");
  // Tapping Reschedule commits to that sub-flow either way (slots found or
  // not) -- the original Accept/Reject/Reschedule buttons shouldn't still
  // be tappable once the doctor has moved past that decision.
  await clearMessageButtons(chatId, callbackQuery.message.message_id);

  if (openSlots.length === 0) {
    await sendTelegramMessage(
      chatId,
      `${doctorLabel(appointment.doctor.name)} has no other open slots to reschedule into right now -- open more availability in the app first.`
    );
    return;
  }

  const keyboard = openSlots.map((slot) => [
    { text: formatClinicDateTime(slot.startTime), callback_data: `rt:${appointmentId}:${slot._id}` },
  ]);

  await sendTelegramMessage(
    chatId,
    `Pick a new time for ${appointment.patientInfo.name}'s appointment with ${doctorLabel(appointment.doctor.name)}:`,
    keyboard
  );
};

// A tap on one of the slot options from handleReschedulePrompt. Runs
// through the same applyReschedule() the REST reschedule endpoint uses.
const handleRescheduleConfirm = async (callbackQuery, chatId, appointmentId, slotId) => {
  const { doctor, appointment } = await findLinkedDoctorAndAppointment(chatId, appointmentId);

  if (!doctor || !appointment) {
    await answerCallbackQuery(callbackQuery.id, "This request isn't linked to your account");
    return;
  }

  const result = await applyReschedule({
    appointment,
    actingUserId: doctor._id,
    actingUserRole: "doctor",
    newSlotId: slotId,
  });

  if (result.error) {
    // Unlike accept/reject, this can be a transient race (someone else took
    // the slot) -- leave the other options on this message tappable instead
    // of stripping the whole list over one failed pick.
    await answerCallbackQuery(callbackQuery.id, result.error.message);
    return;
  }

  await answerCallbackQuery(callbackQuery.id, "Rescheduled");
  await clearMessageButtons(chatId, callbackQuery.message.message_id);
  await sendTelegramMessage(
    chatId,
    `🔄 Rescheduled — ${doctorLabel(appointment.doctor.name)}: ${appointment.patientInfo.name}'s appointment is now on ${formatClinicDateTime(result.appointment.date)}.`
  );
};

const handleCallbackQuery = async (callbackQuery) => {
  const [action, appointmentId, slotId] = (callbackQuery.data || "").split(":");
  const chatId = String(callbackQuery.message?.chat?.id || "");

  if (!appointmentId) {
    await answerCallbackQuery(callbackQuery.id, "Unrecognized action");
    return;
  }

  if (action === "rs") return handleReschedulePrompt(callbackQuery, chatId, appointmentId);
  if (action === "rt") return handleRescheduleConfirm(callbackQuery, chatId, appointmentId, slotId);
  if (action === "acc" || action === "rej") return handleAcceptReject(callbackQuery, chatId, action, appointmentId);

  await answerCallbackQuery(callbackQuery.id, "Unrecognized action");
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
