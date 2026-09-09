const asyncHandler = require("../utils/asyncHandler");
const Availability = require("../models/Availability");

const generateSlots = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, slotMinutes } = req.body;

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const dayStart = new Date(date);
  dayStart.setHours(startHour, startMin, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, endMin, 0, 0);

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
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
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
