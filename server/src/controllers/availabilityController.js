const asyncHandler = require("../utils/asyncHandler");
const Availability = require("../models/Availability");

// The organization operates in India (IST, UTC+5:30). Doctors enter times as
// their own local wall-clock (e.g. "14:00" means 2pm where they are), so that
// has to be converted to a real UTC instant explicitly here rather than via
// `new Date(dateStr).setHours(...)` -- that approach silently uses whatever
// timezone the Node process happens to be running in (UTC on Render), not the
// clinic's, which corrupted every slot created through the app by 5.5 hours.
const CLINIC_UTC_OFFSET_MINUTES = 330;

const clinicDateTime = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - CLINIC_UTC_OFFSET_MINUTES * 60000);
};

const clinicDayStart = (dateStr) => clinicDateTime(dateStr, "00:00");
const clinicDayEnd = (dateStr) => new Date(clinicDayStart(dateStr).getTime() + 24 * 60 * 60000 - 1);

// Pure calendar-string arithmetic for stepping through a recurring range and
// reading a date's weekday. Deliberately never goes through clinicDateTime or
// any host-timezone-sensitive Date method (like the local .getDay()) -- that
// was exactly the bug class that corrupted slot times before (see above).
// Anchoring every calculation at noon UTC keeps it identical regardless of
// which timezone the Node process itself happens to be running in.
const addDaysToDateStr = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + days);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

const weekdayOfDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
};

const daysBetweenDateStrs = (fromStr, toStr) => {
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2, 12) - Date.UTC(y1, m1 - 1, d1, 12)) / 86400000);
};

const MAX_REPEAT_DAYS = 90;
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

const generateSlots = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, slotMinutes, repeatUntil, repeatOn } = req.body;

  if (clinicDateTime(date, endTime) <= clinicDateTime(date, startTime)) {
    return res.status(400).json({ message: "endTime must be after startTime" });
  }

  let dateStrs = [date];

  if (repeatUntil) {
    const span = daysBetweenDateStrs(date, repeatUntil);
    if (span < 0) {
      return res.status(400).json({ message: "repeatUntil must be on or after date" });
    }
    if (span >= MAX_REPEAT_DAYS) {
      return res.status(400).json({ message: `Recurring range can't exceed ${MAX_REPEAT_DAYS} days` });
    }

    const weekdays = new Set(repeatOn && repeatOn.length ? repeatOn : DEFAULT_WEEKDAYS);
    dateStrs = [];
    for (let i = 0; i <= span; i++) {
      const dStr = addDaysToDateStr(date, i);
      if (weekdays.has(weekdayOfDateStr(dStr))) dateStrs.push(dStr);
    }
  }

  const buildDaySlots = (dateStr) => {
    const dayStart = clinicDateTime(dateStr, startTime);
    const dayEnd = clinicDateTime(dateStr, endTime);
    const daySlots = [];
    let cursor = new Date(dayStart);
    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + slotMinutes * 60000);
      if (slotEnd > dayEnd) break;
      daySlots.push({ doctor: req.user._id, startTime: new Date(cursor), endTime: slotEnd });
      cursor = slotEnd;
    }
    return daySlots;
  };

  const slots = dateStrs.flatMap(buildDaySlots);

  if (slots.length === 0) {
    return res.status(400).json({ message: "No slots fit in that time range" });
  }

  let createdCount = slots.length;
  try {
    await Availability.insertMany(slots, { ordered: false });
  } catch (error) {
    if (error.name === "MongoBulkWriteError" || error.code === 11000) {
      createdCount = error.result?.nInserted ?? 0;
    } else {
      throw error;
    }
  }

  res.status(201).json({
    message:
      dateStrs.length > 1
        ? `Created ${createdCount} of ${slots.length} slot(s) across ${dateStrs.length} day(s) (duplicates skipped)`
        : `Created ${createdCount} of ${slots.length} slot(s) (duplicates skipped)`,
    created: createdCount,
    daysCovered: dateStrs.length,
  });
});

const getAvailableSlots = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;

  const now = new Date();
  let from = now;
  let to;

  if (date) {
    const dayStart = clinicDayStart(date);
    const dayEnd = clinicDayEnd(date);
    from = dayStart > now ? dayStart : now;
    to = dayEnd;
  }

  const slots = await Availability.find({
    doctor: doctorId,
    isBooked: false,
    startTime: to ? { $gte: from, $lte: to } : { $gte: from },
  }).sort({ startTime: 1 });

  res.json(slots);
});

const getMySlots = asyncHandler(async (req, res) => {
  const slots = await Availability.find({
    doctor: req.user._id,
    startTime: { $gte: new Date() },
  }).sort({ startTime: 1 });

  res.json(slots);
});

const deleteSlot = asyncHandler(async (req, res) => {
  const slot = await Availability.findById(req.params.id);

  if (!slot) {
    return res.status(404).json({ message: "Slot not found" });
  }

  if (!slot.doctor.equals(req.user._id)) {
    return res.status(403).json({ message: "Not authorized to delete this slot" });
  }

  if (slot.isBooked) {
    return res.status(400).json({ message: "Cannot delete a booked slot" });
  }

  await slot.deleteOne();
  res.json({ message: "Slot removed" });
});

// A block is implemented as isBooked:true (so it's excluded from booking and
// can't be double-claimed) plus blockedReason -- see models/Availability.js.
const blockSlot = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const slot = await Availability.findOneAndUpdate(
    { _id: req.params.id, doctor: req.user._id, isBooked: false },
    { isBooked: true, blockedReason: reason },
    { returnDocument: "after" }
  );

  if (!slot) {
    return res.status(409).json({ message: "That slot can't be blocked (already booked, blocked, or not yours)" });
  }

  res.json(slot);
});

const unblockSlot = asyncHandler(async (req, res) => {
  const slot = await Availability.findOneAndUpdate(
    { _id: req.params.id, doctor: req.user._id, blockedReason: { $ne: null } },
    { isBooked: false, blockedReason: null },
    { returnDocument: "after" }
  );

  if (!slot) {
    return res.status(404).json({ message: "No blocked slot found to unblock" });
  }

  res.json(slot);
});

module.exports = { generateSlots, getAvailableSlots, getMySlots, deleteSlot, blockSlot, unblockSlot };
