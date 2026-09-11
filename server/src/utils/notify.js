const Notification = require("../models/Notification");

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
};

module.exports = notify;
