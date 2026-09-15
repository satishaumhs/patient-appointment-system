const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendTelegramMessage } = require("./telegramBot");

// Which doctor preference gates each doctor-audience event, and whether it
// gets Accept/Reject buttons (only a brand new request has anything to act
// on -- everything else is informational).
const DOCTOR_EVENT_CONFIG = {
  new_request: { preference: "notifyNewRequest", actionable: true },
  cancelled_by_patient: { preference: "notifyStatusChange", actionable: false },
  payment_received: { preference: "notifyPayment", actionable: false },
};

// Deliberately not awaited by notify() -- a slow or failed Telegram call
// must never delay or break the core appointment action it's reporting on.
const sendDoctorTelegramNotice = async ({ appointment, doctor, event, title, message }) => {
  const config = DOCTOR_EVENT_CONFIG[event];
  if (!config) return;

  const doctorUser = await User.findById(doctor).select(`+telegram.chatId telegram.${config.preference}`);
  if (!doctorUser?.telegram?.chatId || doctorUser.telegram[config.preference] === false) return;

  const inlineKeyboard = config.actionable
    ? [
        [
          { text: "✅ Accept", callback_data: `acc:${appointment._id}` },
          { text: "❌ Reject", callback_data: `rej:${appointment._id}` },
        ],
      ]
    : undefined;

  const result = await sendTelegramMessage(doctorUser.telegram.chatId, `<b>${title}</b>\n${message}`, inlineKeyboard);

  // Telegram's API answers with 200 + {ok:false} for plenty of real cases
  // (the doctor blocked the bot, deleted the chat) rather than an HTTP
  // error, so fetch/callTelegram never throws for those -- check explicitly
  // or a doctor silently stops getting notified with nothing in the logs.
  if (result?.ok === false) {
    console.error(`[Telegram] API rejected doctor notice: ${result.description}`);
  }
};

// Demo notification "send": no third-party email/SMS provider is wired up,
// so this both (a) persists a real, in-app notification -- the doctor bell
// and the patient status-page timeline both read from this, they're not
// placeholders -- and (b) logs what a real provider integration would have
// sent, as a clearly-labeled stand-in, when the patient gave an email.
const notify = async ({ appointment, audience, doctor, event, title, message }) => {
  await Notification.create({ appointment: appointment._id, audience, doctor, event, title, message });

  if (audience === "patient" && appointment.patientInfo?.email) {
    console.log(`[DEMO EMAIL] to ${appointment.patientInfo.email}: ${title} -- ${message}`);
  }

  if (audience === "doctor" && doctor) {
    sendDoctorTelegramNotice({ appointment, doctor, event, title, message }).catch((error) => {
      console.error("[Telegram] failed to deliver doctor notice:", error.message);
    });
  }
};

module.exports = notify;
