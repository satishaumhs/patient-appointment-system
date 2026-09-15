const asyncHandler = require("../utils/asyncHandler");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const Notification = require("../models/Notification");
const Review = require("../models/Review");
const User = require("../models/User");
const generateReferenceNumber = require("../utils/generateReferenceNumber");
const generateVideoLink = require("../utils/generateVideoLink");
const notify = require("../utils/notify");
const doctorLabel = require("../utils/doctorLabel");
const { notifyWaitlist } = require("./waitlistController");

const TERMINAL_STATUSES = ["completed", "cancelled", "rejected"];

// Same clinic offset as availabilityController's clinicDayStart/End -- see
// that file's comment for why this can't be the host process's own timezone.
const CLINIC_UTC_OFFSET_MINUTES = 330;

// A cancelled/rejected visit is never paid for. A charge that was only ever
// "pending" simply stops being owed; one that was already "paid" needs to be
// represented as owed BACK, not silently left looking like the clinic kept
// money for a visit that isn't happening.
const releasePaymentOnCancellation = (appointment) => {
  if (appointment.payment.status === "pending") {
    appointment.payment.status = "not_required";
  } else if (appointment.payment.status === "paid") {
    appointment.payment.status = "refunded";
    appointment.payment.refundedAt = new Date();
  }
};

// A completed in-person visit that was still "pay at clinic" is assumed paid
// in cash -- there's no other way the visit could have finished. A video
// visit is left alone (cash doesn't apply -- see markAppointmentPaid) and an
// already-resolved payment is left alone too, via the pending check.
const reconcilePendingCashPayment = (appointment) => {
  if (appointment.appointmentType !== "video" && appointment.payment.status === "pending") {
    appointment.payment.status = "paid";
    appointment.payment.method = "cash";
    appointment.payment.paidAt = new Date();
    appointment.payment.transactionId = `CASH-${Date.now().toString(36).toUpperCase()}-${appointment._id
      .toString()
      .slice(-4)}`;
  }
};

// A video consultation has no "at the clinic" moment to fall back on --
// unlike an in-person visit, cash can never reconcile it (see
// markAppointmentPaid/reconcilePendingCashPayment), so payment has to happen
// online, before or during the call, or not at all. Resolving it to
// "completed" without that would just be trusting a virtual visit happened
// with no evidence it was even paid for. Frees the slot the same way an
// explicit cancellation does, since as far as the record shows the visit
// never properly happened.
const cancelUnpaidVideoAppointment = async (appointment) => {
  appointment.status = "cancelled";
  releasePaymentOnCancellation(appointment);
  await appointment.save();
  await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });
};

// Nothing in this app runs a background job (unreliable on a low-cost host
// that can spin down anyway), so appointments left dangling past their own
// date would otherwise just sit there forever looking active, with stale
// manual actions still showing. Swept lazily at the top of every read path
// instead: cheap at this app's scale, and guarantees the same correction
// shows up everywhere (dashboard, admin analytics, patient status lookup)
// rather than only wherever happens to be visited first. Three passes:
//
// 1. "confirmed" + slot ended: a doctor already agreed to the visit, so once
//    its time has passed the system assumes an in-person one happened
//    (auto-completed, pending cash reconciled) -- except a video visit that
//    was never paid online, which has no way to confirm it happened at all,
//    so it's cancelled instead of completed.
// 2. "pending" + slot ended: the doctor never responded in time, so the
//    request itself has expired -- cancelled, same as an explicit reject,
//    releasing/refunding whatever payment state it was in.
// 3. Records already sitting at "completed" or "confirmed" from before this
//    reconciliation logic existed (seeded directly in that shape, or
//    completed under the old rules before video required payment): swept
//    the same way a newly-overdue one would be, so old data converges to the
//    current rules instead of staying stuck exactly as it was written.
const settleOverdueAppointments = async () => {
  const confirmed = await Appointment.find({ status: "confirmed" }).populate("slot", "endTime");
  const overdueConfirmed = confirmed.filter(
    (appointment) => appointment.slot?.endTime && appointment.slot.endTime < new Date()
  );
  for (const appointment of overdueConfirmed) {
    if (appointment.appointmentType === "video" && appointment.payment.status === "pending") {
      await cancelUnpaidVideoAppointment(appointment);
      continue;
    }
    appointment.status = "completed";
    reconcilePendingCashPayment(appointment);
    await appointment.save();
  }

  const pending = await Appointment.find({ status: "pending" }).populate("slot", "endTime");
  const overduePending = pending.filter(
    (appointment) => appointment.slot?.endTime && appointment.slot.endTime < new Date()
  );
  for (const appointment of overduePending) {
    appointment.status = "cancelled";
    releasePaymentOnCancellation(appointment);
    await appointment.save();
    await Availability.findByIdAndUpdate(appointment.slot, { isBooked: false });
  }

  const staleCompleted = await Appointment.find({ status: "completed" });
  for (const appointment of staleCompleted) {
    if (appointment.appointmentType === "video") {
      if (appointment.payment.status === "pending") {
        await cancelUnpaidVideoAppointment(appointment);
      }
      continue;
    }
    if (appointment.payment.status === "pending") {
      reconcilePendingCashPayment(appointment);
      await appointment.save();
    }
  }
};

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
  await settleOverdueAppointments();

  const filter = {};

  if (req.user.role === "doctor") {
    filter.doctor = req.user._id;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const appointments = await Appointment.find(filter)
    .populate("doctor", "name email")
    .populate("slot", "endTime")
    .sort({ date: 1 });

  res.json(appointments);
});

const getAppointmentById = asyncHandler(async (req, res) => {
  await settleOverdueAppointments();

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

  await settleOverdueAppointments();

  const appointment = await Appointment.findOne({ referenceNumber })
    .populate("doctor", "name specialization")
    .populate("slot", "endTime");

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
    slot: appointment.slot,
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

// The actual status-change rules and side effects, deliberately kept
// independent of req/res -- both the REST endpoint below and the Telegram
// webhook's Accept/Reject buttons need to apply the exact same guards and
// notifications, and duplicating this logic would let the two drift apart.
// Returns { error: { statusCode, message } } or { appointment }.
const applyStatusChange = async ({ appointment, actingUserId, actingUserRole, status }) => {
  const isOwnerDoctor = appointment.doctor._id.equals(actingUserId);

  if (actingUserRole === "doctor" && !isOwnerDoctor) {
    return { error: { statusCode: 403, message: "Not authorized to update this appointment" } };
  }

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    return { error: { statusCode: 400, message: `Cannot change the status of a ${appointment.status} appointment` } };
  }

  if (status === "confirmed" && appointment.date < new Date()) {
    return {
      error: { statusCode: 400, message: "Cannot confirm an appointment whose scheduled time has already passed" },
    };
  }

  if (status === "completed" && appointment.date > new Date()) {
    return { error: { statusCode: 400, message: "Cannot mark an appointment complete before its scheduled date" } };
  }

  // A video visit has no cash fallback -- payment has to happen online, so
  // it can't be considered complete until that's actually settled.
  if (status === "completed" && appointment.appointmentType === "video" && appointment.payment.status === "pending") {
    return {
      error: {
        statusCode: 400,
        message: "This video consultation needs to be paid online before it can be marked complete",
      },
    };
  }

  if (status === "confirmed" && appointment.appointmentType === "video" && !appointment.videoLink) {
    appointment.videoLink = generateVideoLink(appointment.referenceNumber);
  }

  if (status === "completed") {
    reconcilePendingCashPayment(appointment);
  }

  // A cancelled/rejected appointment is never paid for -- release a pending
  // charge, or flag an already-paid one as refunded, rather than leaving a
  // stale "payment pending"/"paid" on something that isn't happening.
  // (Patient self-cancel has its own equivalent in cancelAppointmentByReference.)
  if (["cancelled", "rejected"].includes(status)) {
    releasePaymentOnCancellation(appointment);
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

  return { appointment };
};

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate("doctor", "name email");

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const result = await applyStatusChange({
    appointment,
    actingUserId: req.user._id,
    actingUserRole: req.user.role,
    status: req.body.status,
  });

  if (result.error) {
    return res.status(result.error.statusCode).json({ message: result.error.message });
  }

  res.json(result.appointment);
});

// Same split as applyStatusChange/updateAppointmentStatus -- the Telegram
// reschedule flow needs this exact logic too, not a re-implementation of it.
const applyReschedule = async ({ appointment, actingUserId, actingUserRole, newSlotId }) => {
  const isOwnerDoctor = appointment.doctor._id.equals(actingUserId);
  if (actingUserRole === "doctor" && !isOwnerDoctor) {
    return { error: { statusCode: 403, message: "Not authorized to reschedule this appointment" } };
  }

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    return { error: { statusCode: 400, message: `Cannot reschedule a ${appointment.status} appointment` } };
  }

  if (String(newSlotId) === String(appointment.slot)) {
    return { error: { statusCode: 400, message: "That is already this appointment's scheduled time" } };
  }

  // Same-doctor clause is load-bearing: without it a reschedule could move
  // this appointment onto a different doctor's open slot.
  const newSlot = await Availability.findOneAndUpdate(
    { _id: newSlotId, isBooked: false, doctor: appointment.doctor._id },
    { isBooked: true },
    { returnDocument: "after" }
  );

  if (!newSlot) {
    return { error: { statusCode: 409, message: "That slot is not available for this doctor" } };
  }

  if (newSlot.startTime < new Date()) {
    newSlot.isBooked = false;
    await newSlot.save();
    return { error: { statusCode: 400, message: "Cannot reschedule to a slot in the past" } };
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

  return { appointment };
};

const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { newSlotId } = req.body;

  const appointment = await Appointment.findById(req.params.id).populate("doctor", "name email");
  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const result = await applyReschedule({
    appointment,
    actingUserId: req.user._id,
    actingUserRole: req.user.role,
    newSlotId,
  });

  if (result.error) {
    return res.status(result.error.statusCode).json({ message: result.error.message });
  }

  res.json(result.appointment);
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
  releasePaymentOnCancellation(appointment);
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

  res.json({ referenceNumber: appointment.referenceNumber, status: appointment.status, payment: appointment.payment });
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

// Doctor/admin-only: reconciles a patient who chose "pay at clinic" instead
// of the demo digital flow -- without this, that appointment's payment
// stays "pending" forever with no way to record the cash actually collected.
const markAppointmentPaid = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwnerDoctor = appointment.doctor.equals(req.user._id);
  if (req.user.role === "doctor" && !isOwnerDoctor) {
    return res.status(403).json({ message: "Not authorized to update this appointment" });
  }

  if (appointment.payment.status !== "pending") {
    return res.status(400).json({ message: `Payment is already ${appointment.payment.status}` });
  }

  // Cash means paid in person at the clinic -- doesn't apply to a video
  // visit, and can't have happened yet if the visit itself hasn't.
  if (appointment.appointmentType === "video") {
    return res.status(400).json({ message: "Cash payment isn't applicable to a video consultation" });
  }

  if (appointment.date > new Date()) {
    return res.status(400).json({ message: "Cannot mark payment as paid before the appointment date" });
  }

  appointment.payment.status = "paid";
  appointment.payment.method = "cash";
  appointment.payment.paidAt = new Date();
  appointment.payment.transactionId = `CASH-${Date.now().toString(36).toUpperCase()}`;
  await appointment.save();

  res.json(appointment);
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
  applyStatusChange,
  rescheduleAppointment,
  applyReschedule,
  cancelAppointmentByReference,
  payAppointmentByReference,
  submitReview,
  markAppointmentPaid,
  deleteAppointment,
  settleOverdueAppointments,
  TERMINAL_STATUSES,
};
