// Plain Date.toLocaleString() formats in whatever timezone the host process
// happens to be running in -- UTC on Render, not the clinic's IST -- the
// same class of bug availabilityController.js's clinicDateTime already had
// to correct for slot creation. Every message that reports a date/time to a
// doctor or patient (in-app notification text, Telegram messages) needs to
// show clinic-local time regardless of where the server itself is hosted,
// so this is the one place that conversion should happen.
const CLINIC_TIMEZONE = "Asia/Kolkata";

const formatClinicDateTime = (date) => date.toLocaleString("en-US", { timeZone: CLINIC_TIMEZONE });

// Compact form for things like a Telegram slot-picker button label, where
// full precision (year, seconds) is just noise -- "Sep 16, 9:00 AM".
const formatClinicDateTimeShort = (date) =>
  date.toLocaleString("en-US", {
    timeZone: CLINIC_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

module.exports = formatClinicDateTime;
module.exports.short = formatClinicDateTimeShort;
