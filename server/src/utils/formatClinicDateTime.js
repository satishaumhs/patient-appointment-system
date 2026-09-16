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

// A stable clinic-local calendar-day key ("2026-09-18") for grouping slots
// by day -- en-CA is the one common locale whose toLocaleDateString output
// is already ISO-shaped, so no manual date-string assembly is needed. Must
// be used for both the grouping and the later re-filtering of a picked day
// (see telegramController.js) so a slot near midnight IST can't land in one
// day's bucket but get compared against a different day's key.
const formatClinicDayKey = (date) => date.toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });

// "Fri, Sep 19" -- a day-picker button label.
const formatClinicDayLabel = (date) =>
  date.toLocaleDateString("en-US", { timeZone: CLINIC_TIMEZONE, weekday: "short", month: "short", day: "numeric" });

// "9:00 AM" -- once a day has already been picked, repeating its date on
// every time button is redundant; this is the compact per-slot label.
const formatClinicTimeOnly = (date) =>
  date.toLocaleString("en-US", { timeZone: CLINIC_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });

module.exports = formatClinicDateTime;
module.exports.short = formatClinicDateTimeShort;
module.exports.dayKey = formatClinicDayKey;
module.exports.dayLabel = formatClinicDayLabel;
module.exports.timeOnly = formatClinicTimeOnly;
