// Shared by appointmentController, telegramController, and notify -- kept
// standalone (rather than defined on/exported from appointmentController)
// so notify.js can use it without an appointmentController <-> notify
// circular require (appointmentController already requires notify).
const doctorLabel = (name) => (name?.startsWith("Dr.") ? name : `Dr. ${name}`);

module.exports = doctorLabel;
