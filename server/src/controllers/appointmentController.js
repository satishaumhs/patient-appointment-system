const asyncHandler = require("../utils/asyncHandler");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const generateReferenceNumber = require("../utils/generateReferenceNumber");

const TERMINAL_STATUSES = ["completed", "cancelled", "rejected"];

const createAppointment = asyncHandler(async (req, res) => {
  const { slotId, reason, appointmentType, patientInfo } = req.body;

  // Atomic claim: only one concurrent request can win the isBooked:false filter.
  const slot = await Availability.findOneAndUpdate(
    { _id: slotId, isBooked: false },
    { isBooked: true },
    { returnDocument: "after" }
  );

  if (!slot) {
    return res.status(409).json({ message: "That slot is no longer available" });
  }

  if (slot.startTime < new Date()) {
    slot.isBooked = false;
    await slot.save();
    return res.status(400).json({ message: "Cannot book a slot in the past" });
  }

  // Retries on the rare reference-number collision race (check-then-insert),
  // same duplicate-key idiom generateSlots already uses elsewhere.
  for (let attempt = 0; attempt < 5; attempt++) {
    const referenceNumber = await generateReferenceNumber();
    try {
      const appointment = await Appointment.create({
        doctor: slot.doctor,
        slot: slot._id,
        date: slot.startTime,
        reason,
        appointmentType,
        patientInfo,
        referenceNumber,
      });
      return res.status(201).json(appointment);
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.referenceNumber) {
        continue;
      }
      slot.isBooked = false;
      await slot.save();
      throw error;
    }
  }

  slot.isBooked = false;
  await slot.save();
  res.status(500).json({ message: "Could not generate a unique reference number, please try again" });
});

const getAppointments = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === "doctor") {
    filter.doctor = req.user._id;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const appointments = await Appointment.find(filter).populate("doctor", "name email").sort({ date: 1 });

  res.json(appointments);
});

const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate("doctor", "name email");

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwner = appointment.doctor._id.equals(req.user._id);

  if (req.user.role !== "admin" && !isOwner) {
    return res.status(403).json({ message: "Not authorized to view this appointment" });
  }

  res.json(appointment);
});

// Public: a patient looks their own request up with the reference number they
// were given at booking time, plus the phone number they booked with. Both
// must match. Deliberately returns the SAME 404 whether the reference number
// doesn't exist or the phone doesn't match it -- otherwise the endpoint could
// be used to confirm someone's phone number is tied to a specific booking.
const getAppointmentByReference = asyncHandler(async (req, res) => {
  const { referenceNumber } = req.params;
  const { phone } = req.body;

  const appointment = await Appointment.findOne({ referenceNumber }).populate(
    "doctor",
    "name specialization"
  );

  if (!appointment || appointment.patientInfo.phone !== phone) {
    return res.status(404).json({ message: "No appointment found for that reference number and phone number" });
  }

  res.json({
    referenceNumber: appointment.referenceNumber,
    patientName: appointment.patientInfo.name,
    doctor: appointment.doctor,
    date: appointment.date,
    appointmentType: appointment.appointmentType,
    status: appointment.status,
  });
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwnerDoctor = appointment.doctor.equals(req.user._id);

  if (req.user.role === "doctor" && !isOwnerDoctor) {
    return res.status(403).json({ message: "Not authorized to update this appointment" });
  }

  appointment.status = req.body.status;
  await appointment.save();

  if (["cancelled", "rejected"].includes(req.body.status)) {
    await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });
  }

  res.json(appointment);
});

const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { newSlotId } = req.body;

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwnerDoctor = appointment.doctor.equals(req.user._id);
  if (req.user.role === "doctor" && !isOwnerDoctor) {
    return res.status(403).json({ message: "Not authorized to reschedule this appointment" });
  }

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    return res.status(400).json({ message: `Cannot reschedule a ${appointment.status} appointment` });
  }

  if (String(newSlotId) === String(appointment.slot)) {
    return res.status(400).json({ message: "That is already this appointment's scheduled time" });
  }

  // Same-doctor clause is load-bearing: without it a reschedule could move
  // this appointment onto a different doctor's open slot.
  const newSlot = await Availability.findOneAndUpdate(
    { _id: newSlotId, isBooked: false, doctor: appointment.doctor },
    { isBooked: true },
    { returnDocument: "after" }
  );

  if (!newSlot) {
    return res.status(409).json({ message: "That slot is not available for this doctor" });
  }

  if (newSlot.startTime < new Date()) {
    newSlot.isBooked = false;
    await newSlot.save();
    return res.status(400).json({ message: "Cannot reschedule to a slot in the past" });
  }

  const oldSlotId = appointment.slot;

  try {
    appointment.slot = newSlot._id;
    appointment.date = newSlot.startTime;
    appointment.status = "confirmed";
    await appointment.save();
  } catch (error) {
    newSlot.isBooked = false;
    await newSlot.save();
    throw error;
  }

  await Availability.findByIdAndUpdate(oldSlotId, { isBooked: false });

  res.json(appointment);
});

const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  await appointment.deleteOne();
  await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });

  res.json({ message: "Appointment removed" });
});

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  getAppointmentByReference,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
};
