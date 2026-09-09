const asyncHandler = require("../utils/asyncHandler");
const Appointment = require("../models/Appointment");
const User = require("../models/User");

const createAppointment = asyncHandler(async (req, res) => {
  const { doctor, date, reason } = req.body;

  const doctorUser = await User.findOne({ _id: doctor, role: "doctor" });

  if (!doctorUser) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const appointment = await Appointment.create({
    patient: req.user._id,
    doctor,
    date,
    reason,
  });

  res.status(201).json(appointment);
});

const getAppointments = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === "patient") {
    filter.patient = req.user._id;
  } else if (req.user.role === "doctor") {
    filter.doctor = req.user._id;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const appointments = await Appointment.find(filter)
    .populate("patient", "name email")
    .populate("doctor", "name email")
    .sort({ date: 1 });

  res.json(appointments);
});

const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate("patient", "name email")
    .populate("doctor", "name email");

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwner =
    appointment.patient._id.equals(req.user._id) ||
    appointment.doctor._id.equals(req.user._id);

  if (req.user.role !== "admin" && !isOwner) {
    return res.status(403).json({ message: "Not authorized to view this appointment" });
  }

  res.json(appointment);
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  const isOwnerDoctor = appointment.doctor.equals(req.user._id);
  const isOwnerPatient = appointment.patient.equals(req.user._id);

  if (req.user.role === "patient") {
    if (!isOwnerPatient || req.body.status !== "cancelled") {
      return res.status(403).json({
        message: "Patients may only cancel their own appointments",
      });
    }
  } else if (req.user.role === "doctor" && !isOwnerDoctor) {
    return res.status(403).json({ message: "Not authorized to update this appointment" });
  }

  appointment.status = req.body.status;
  await appointment.save();

  res.json(appointment);
});

const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ message: "Appointment not found" });
  }

  await appointment.deleteOne();

  res.json({ message: "Appointment removed" });
});

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
};
