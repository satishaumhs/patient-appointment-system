const asyncHandler = require("../utils/asyncHandler");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const Notification = require("../models/Notification");
const Review = require("../models/Review");
const User = require("../models/User");
const generateReferenceNumber = require("../utils/generateReferenceNumber");
const generateVideoLink = require("../utils/generateVideoLink");
const notify = require("../utils/notify");
const { notifyWaitlist } = require("./waitlistController");

const TERMINAL_STATUSES = ["completed", "cancelled", "rejected"];

// Every seeded doctor's name already starts with "Dr." (and most real
// self-registrations follow the same convention) -- prefixing unconditionally
// produces "Dr. Dr. James Okafor" in notification text. Only add it when it's
// genuinely missing.
const doctorLabel = (name) => (name?.startsWith("Dr.") ? name : `Dr. ${name}`);

// Same clinic offset as availabilityController's clinicDayStart/End -- see
// that file's comment for why this can't be the host process's own timezone.
const CLINIC_UTC_OFFSET_MINUTES = 330;

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

  const doctorUser = await User.findById(slot.doctor).select("name email consultationFee");
  const payment =
    doctorUser?.consultationFee != null
      ? { status: "pending", amount: doctorUser.consultationFee }
      : { status: "not_required" };

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
        payment,
      });

      await notify({
        appointment,
        audience: "doctor",
        doctor: slot.doctor,
        event: "new_request",
        title: "New appointment request",
        message: `${patientInfo.name} requested an appointment on ${appointment.date.toLocaleString()}.`,
      });
      await notify({
        appointment,
        audience: "patient",
        event: "request_received",
        title: "Request received",
        message: `We received your appointment request with ${doctorUser?.name ? doctorLabel(doctorUser.name) : "your doctor"}. You'll be notified once it's confirmed.`,
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

  const [hasReview, timeline] = await Promise.all([
    Review.exists({ appointment: appointment._id }),
    Notification.find({ appointment: appointment._id, audience: "patient" })
      .sort({ createdAt: 1 })
      .select("event title message createdAt"),
  ]);

  let queuePosition = null;
  if (appointment.status === "confirmed") {
    // "Ahead of you today": other confirmed visits with the same doctor,
    // same IST calendar day, at an earlier time. Day boundaries are
    // computed via the clinic's UTC offset rather than the host process's
    // own timezone -- see availabilityController's clinicDayStart/End for
    // why that distinction matters on this project.
    const istMoment = new Date(appointment.date.getTime() + CLINIC_UTC_OFFSET_MINUTES * 60000);
    istMoment.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(istMoment.getTime() - CLINIC_UTC_OFFSET_MINUTES * 60000);

    queuePosition = await Appointment.countDocuments({
      doctor: appointment.doctor._id,
      status: "confirmed",
      date: { $gte: dayStart, $lt: appointment.date },
    });
  }

  res.json({
    referenceNumber: appointment.referenceNumber,
    patientName: appointment.patientInfo.name,
    patientInfo: appointment.patientInfo,
    doctor: appointment.doctor,
    date: appointment.date,
    reason: appointment.status === "completed" ? appointment.reason : undefined,
    appointmentType: appointment.appointmentType,
    status: appointment.status,
    videoLink: appointment.status === "confirmed" ? appointment.videoLink : undefined,
    payment: appointment.payment,
    hasReview: Boolean(hasReview),
    timeline,
    queuePosition,
  });
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate("doctor", "name email");

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwnerDoctor = appointment.doctor._id.equals(req.user._id);

  if (req.user.role === "doctor" && !isOwnerDoctor) {
    return res.status(403).json({ message: "Not authorized to update this appointment" });
  }

  const { status } = req.body;

  if (status === "confirmed" && appointment.appointmentType === "video" && !appointment.videoLink) {
    appointment.videoLink = generateVideoLink(appointment.referenceNumber);
  }

  appointment.status = status;
  await appointment.save();

  if (["cancelled", "rejected"].includes(status)) {
    await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });
    await notifyWaitlist(appointment.doctor._id);
  }

  const PATIENT_NOTICES = {
    confirmed: {
      event: "confirmed",
      title: "Appointment confirmed",
      message: `Your appointment with ${doctorLabel(appointment.doctor.name)} on ${appointment.date.toLocaleString()} has been confirmed.`,
    },
    rejected: {
      event: "rejected",
      title: "Appointment declined",
      message: `Your appointment request with ${doctorLabel(appointment.doctor.name)} couldn't be accommodated. Please book another time.`,
    },
    completed: {
      event: "completed",
      title: "Visit completed",
      message: `Your visit with ${doctorLabel(appointment.doctor.name)} is complete. Thanks for choosing My Health School.`,
    },
  };

  const notice = PATIENT_NOTICES[status];
  if (notice) {
    await notify({ appointment, audience: "patient", ...notice });
  }

  res.json(appointment);
});

const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { newSlotId } = req.body;

  const appointment = await Appointment.findById(req.params.id).populate("doctor", "name email");
  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwnerDoctor = appointment.doctor._id.equals(req.user._id);
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
    { _id: newSlotId, isBooked: false, doctor: appointment.doctor._id },
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
    if (appointment.appointmentType === "video" && !appointment.videoLink) {
      appointment.videoLink = generateVideoLink(appointment.referenceNumber);
    }
    await appointment.save();
  } catch (error) {
    newSlot.isBooked = false;
    await newSlot.save();
    throw error;
  }

  await Availability.findByIdAndUpdate(oldSlotId, { isBooked: false });

  await notify({
    appointment,
    audience: "patient",
    event: "rescheduled",
    title: "Appointment rescheduled",
    message: `Your appointment with ${doctorLabel(appointment.doctor.name)} has been rescheduled to ${appointment.date.toLocaleString()}.`,
  });

  res.json(appointment);
});

// Public: same reference+phone gate as getAppointmentByReference.
const cancelAppointmentByReference = asyncHandler(async (req, res) => {
  const { referenceNumber } = req.params;
  const { phone } = req.body;

  const appointment = await Appointment.findOne({ referenceNumber }).populate("doctor", "name");

  if (!appointment || appointment.patientInfo.phone !== phone) {
    return res.status(404).json({ message: "No appointment found for that reference number and phone number" });
  }

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    return res
      .status(400)
      .json({ message: `This appointment is already ${appointment.status} and can't be cancelled` });
  }

  appointment.status = "cancelled";
  await appointment.save();
  await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });
  await notifyWaitlist(appointment.doctor._id);

  await notify({
    appointment,
    audience: "doctor",
    doctor: appointment.doctor._id,
    event: "cancelled_by_patient",
    title: "Appointment cancelled",
    message: `${appointment.patientInfo.name} cancelled their appointment on ${appointment.date.toLocaleString()}.`,
  });

  res.json({ referenceNumber: appointment.referenceNumber, status: appointment.status });
});

// Public: same reference+phone gate. Demo only -- no real payment gateway.
const payAppointmentByReference = asyncHandler(async (req, res) => {
  const { referenceNumber } = req.params;
  const { phone, method } = req.body;

  const appointment = await Appointment.findOne({ referenceNumber });

  if (!appointment || appointment.patientInfo.phone !== phone) {
    return res.status(404).json({ message: "No appointment found for that reference number and phone number" });
  }

  if (appointment.payment.status === "not_required") {
    return res.status(400).json({ message: "No payment is required for this appointment" });
  }

  if (appointment.payment.status === "paid") {
    return res.status(400).json({ message: "This appointment has already been paid for" });
  }

  if (["cancelled", "rejected"].includes(appointment.status)) {
    return res.status(400).json({ message: "This appointment is no longer active" });
  }

  appointment.payment.status = "paid";
  appointment.payment.method = method;
  appointment.payment.paidAt = new Date();
  appointment.payment.transactionId = `DEMO-${Date.now().toString(36).toUpperCase()}`;
  await appointment.save();

  await notify({
    appointment,
    audience: "doctor",
    doctor: appointment.doctor,
    event: "payment_received",
    title: "Payment received (demo)",
    message: `${appointment.patientInfo.name} paid ₹${appointment.payment.amount} (demo) for their appointment.`,
  });

  res.json({ referenceNumber: appointment.referenceNumber, payment: appointment.payment });
});

// Public: same reference+phone gate, only for a visit that actually happened.
const submitReview = asyncHandler(async (req, res) => {
  const { referenceNumber } = req.params;
  const { phone, rating, comment } = req.body;

  const appointment = await Appointment.findOne({ referenceNumber });

  if (!appointment || appointment.patientInfo.phone !== phone) {
    return res.status(404).json({ message: "No appointment found for that reference number and phone number" });
  }

  if (appointment.status !== "completed") {
    return res.status(400).json({ message: "Only completed appointments can be reviewed" });
  }

  try {
    const review = await Review.create({
      appointment: appointment._id,
      doctor: appointment.doctor,
      patientName: appointment.patientInfo.name,
      rating,
      comment,
    });
    res.status(201).json(review);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "This appointment has already been reviewed" });
    }
    throw error;
  }
});

const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  await appointment.deleteOne();
  await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });
  await notifyWaitlist(appointment.doctor);

  res.json({ message: "Appointment removed" });
});

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  getAppointmentByReference,
  updateAppointmentStatus,
  rescheduleAppointment,
  cancelAppointmentByReference,
  payAppointmentByReference,
  submitReview,
  deleteAppointment,
};
