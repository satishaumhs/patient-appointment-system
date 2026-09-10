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

const generateSlots = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, slotMinutes } = req.body;

  const dayStart = clinicDateTime(date, startTime);
  const dayEnd = clinicDateTime(date, endTime);

  if (dayEnd <= dayStart) {
    return res.status(400).json({ message: "endTime must be after startTime" });
  }

  const slots = [];
  let cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + slotMinutes * 60000);
    if (slotEnd > dayEnd) break;

    slots.push({
      doctor: req.user._id,
      startTime: new Date(cursor),
      endTime: slotEnd,
    });

    cursor = slotEnd;
  }

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
    message: `Created ${createdCount} of ${slots.length} slot(s) (duplicates skipped)`,
    created: createdCount,
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

module.exports = { generateSlots, getAvailableSlots, getMySlots, deleteSlot };
