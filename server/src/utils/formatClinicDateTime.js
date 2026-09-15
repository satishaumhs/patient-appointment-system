// Plain Date.toLocaleString() formats in whatever timezone the host process
// happens to be running in -- UTC on Render, not the clinic's IST -- the
// same class of bug availabilityController.js's clinicDateTime already had
// to correct for slot creation. Every message that reports a date/time to a
// doctor or patient (in-app notification text, Telegram messages) needs to
// show clinic-local time regardless of where the server itself is hosted,
// so this is the one place that conversion should happen.
const formatClinicDateTime = (date) => date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

module.exports = formatClinicDateTime;
