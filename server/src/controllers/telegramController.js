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
// "All the available options" bounded by a window that's actually meaningful
// for a reschedule (a slot two months out is rarely what anyone wants here)
// rather than an arbitrary small count. RESCHEDULE_OPTIONS_SAFETY_CAP is a
// backstop, not the normal control -- it only bites for a doctor with an
// unusually dense open schedule, so a single query can't blow past what's
// reasonable to hand to a doctor at all.
//
// Handing all of those slots to a doctor as one flat button grid doesn't
// scale -- a doctor with 60 open slots across 30 days got a 30-row wall of
// buttons in one message. Instead this is a day picker first (one button
// per date that actually has an opening) and only the tapped day's own
// slots become time buttons, so no single message shows more than a
// handful of options.
const RESCHEDULE_WINDOW_DAYS = 30;
const RESCHEDULE_OPTIONS_SAFETY_CAP = 60;
const RESCHEDULE_DAYS_PER_ROW = 2;
const RESCHEDULE_TIMES_PER_ROW = 3;

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
const issueConnectLink = async (doctorId) => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  await User.findByIdAndUpdate(doctorId, {
    $set: {
      "telegram.pendingConnectToken": crypto.createHash("sha256").update(rawToken).digest("hex"),
      "telegram.pendingConnectExpires": new Date(Date.now() + CONNECT_TOKEN_TTL_MS),
    },
  });

  return {
    url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${rawToken}`,
    expiresInMinutes: CONNECT_TOKEN_TTL_MS / 60000,
  };
};

const getConnectLink = asyncHandler(async (req, res) => {
  res.json(await issueConnectLink(req.user._id));
});

// Admin-only: connecting is still a real Telegram tap by whoever holds the
// phone the link is opened on -- there's no way around that, and no bulk
// "connect everyone" that skips it. This just removes the friction of
// logging in and out as each doctor individually to reach the same button
// every doctor already has on their own My Profile page.
const getConnectLinkForDoctor = asyncHandler(async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.doctorId, role: "doctor" }).select("name");
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  res.json({ ...(await issueConnectLink(doctor._id)), doctorName: doctor.name });
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

// Shared by both reschedule steps below: the doctor's own open slots inside
// the reschedule window, oldest first, bounded by RESCHEDULE_OPTIONS_SAFETY_CAP.
// Re-run on every tap (the day list AND a specific day's times) rather than
// threading one query's result through the callback chain -- Telegram has no
// server-side state between taps, and re-querying means a slot someone else
// just booked can never be offered as if it were still open.
const fetchOpenSlotsForReschedule = async (doctorId) => {
  const windowEnd = new Date(Date.now() + RESCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const openSlots = await Availability.find({
    doctor: doctorId,
    isBooked: false,
    startTime: { $gt: new Date(), $lte: windowEnd },
  })
    .sort({ startTime: 1 })
    .limit(RESCHEDULE_OPTIONS_SAFETY_CAP + 1); // +1 just to detect truncation, not to offer it

  const truncated = openSlots.length > RESCHEDULE_OPTIONS_SAFETY_CAP;
  return { openSlots: truncated ? openSlots.slice(0, RESCHEDULE_OPTIONS_SAFETY_CAP) : openSlots, truncated };
};

// Groups slots (already sorted oldest-first) into clinic-local calendar
// days, preserving that chronological order -- Map iteration order follows
// insertion order, so no separate sort is needed afterward.
const groupSlotsByDay = (slots) => {
  const groups = new Map();
  for (const slot of slots) {
    const key = formatClinicDateTime.dayKey(slot.startTime);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(slot);
  }
  return groups;
};

// A tap on "Reschedule": step 1 of 2. Offers the doctor's open days as
// buttons rather than every open slot at once -- see the RESCHEDULE_*
// comment above. Picking a day drills into handleRescheduleDayPick below.
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

  const { openSlots, truncated } = await fetchOpenSlotsForReschedule(appointment.doctor._id);

  await answerCallbackQuery(callbackQuery.id, "Pick a day");
  // Tapping Reschedule commits to that sub-flow either way (slots found or
  // not) -- the original Accept/Reject/Reschedule buttons shouldn't still
  // be tappable once the doctor has moved past that decision. Re-tapping
  // "Back to dates" from the time-picker also lands here and re-clears
  // whatever message it came from the same way.
  await clearMessageButtons(chatId, callbackQuery.message.message_id);

  if (openSlots.length === 0) {
    await sendTelegramMessage(
      chatId,
      `${doctorLabel(appointment.doctor.name)} has no other open slots in the next ${RESCHEDULE_WINDOW_DAYS} days to reschedule into -- open more availability in the app first.`
    );
    return;
  }

  const dayGroups = groupSlotsByDay(openSlots);
  const dayButtons = [...dayGroups.entries()].map(([dayKey, daySlots]) => ({
    text: `${formatClinicDateTime.dayLabel(daySlots[0].startTime)} (${daySlots.length})`,
    callback_data: `rd:${appointmentId}:${dayKey}`,
  }));
  const keyboard = [];
  for (let i = 0; i < dayButtons.length; i += RESCHEDULE_DAYS_PER_ROW) {
    keyboard.push(dayButtons.slice(i, i + RESCHEDULE_DAYS_PER_ROW));
  }

  const intro = `Pick a day for ${appointment.patientInfo.name}'s appointment with ${doctorLabel(appointment.doctor.name)} (next ${RESCHEDULE_WINDOW_DAYS} days${truncated ? ", earliest openings shown" : ""}):`;
  await sendTelegramMessage(chatId, intro, keyboard);
};

// A tap on one of the day buttons from handleReschedulePrompt: step 2 of 2.
// Re-fetches and re-filters rather than trusting the day list is still
// accurate -- another tap (a different chat managing the same doctor, or the
// doctor themself acting from the app) could have booked into that day
// between the two messages.
const handleRescheduleDayPick = async (callbackQuery, chatId, appointmentId, dayKey) => {
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

  const { openSlots } = await fetchOpenSlotsForReschedule(appointment.doctor._id);
  const daySlots = openSlots.filter((slot) => formatClinicDateTime.dayKey(slot.startTime) === dayKey);

  if (daySlots.length === 0) {
    // A transient race, same as a failed time-pick below -- leave the day
    // list itself tappable so the doctor can just pick a different date
    // instead of losing the whole flow over one now-stale day.
    await answerCallbackQuery(callbackQuery.id, "Those slots were just booked -- pick another day");
    return;
  }

  await answerCallbackQuery(callbackQuery.id, formatClinicDateTime.dayLabel(daySlots[0].startTime));
  await clearMessageButtons(chatId, callbackQuery.message.message_id);

  const buttons = daySlots.map((slot) => ({
    text: formatClinicDateTime.timeOnly(slot.startTime),
    callback_data: `rt:${appointmentId}:${slot._id}`,
  }));
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += RESCHEDULE_TIMES_PER_ROW) {
    keyboard.push(buttons.slice(i, i + RESCHEDULE_TIMES_PER_ROW));
  }
  keyboard.push([{ text: "◀ Back to dates", callback_data: `rs:${appointmentId}` }]);

  const intro = `Pick a new time on ${formatClinicDateTime.dayLabel(daySlots[0].startTime)} for ${appointment.patientInfo.name}'s appointment with ${doctorLabel(appointment.doctor.name)}:`;
  await sendTelegramMessage(chatId, intro, keyboard);
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
  // param is a slot id for "rt", a clinic-local day key ("2026-09-18") for "rd".
  const [action, appointmentId, param] = (callbackQuery.data || "").split(":");
  const chatId = String(callbackQuery.message?.chat?.id || "");

  if (!appointmentId) {
    await answerCallbackQuery(callbackQuery.id, "Unrecognized action");
    return;
  }

  if (action === "rs") return handleReschedulePrompt(callbackQuery, chatId, appointmentId);
  if (action === "rd") return handleRescheduleDayPick(callbackQuery, chatId, appointmentId, param);
  if (action === "rt") return handleRescheduleConfirm(callbackQuery, chatId, appointmentId, param);
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

module.exports = { getConnectLink, getConnectLinkForDoctor, getStatus, disconnect, updatePreferences, handleWebhook };
