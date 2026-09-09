const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");

const getDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({ role: "doctor" }).select(
    "name email specialization location consultationType bio"
  );
  res.json(doctors);
});

const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "doctor" }).select(
    "name email specialization location consultationType bio"
  );

  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  res.json(doctor);
});

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 });
  res.json(users);
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await Appointment.deleteMany({ $or: [{ patient: user._id }, { doctor: user._id }] });
  await Availability.deleteMany({ doctor: user._id });
  await user.deleteOne();

  res.json({ message: "User removed" });
});

module.exports = { getDoctors, getDoctorById, getUsers, deleteUser };
