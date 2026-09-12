const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const Review = require("../models/Review");

const DOCTOR_FIELDS =
  "name email specialization location consultationType bio experience qualification consultationFee";

const getDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({ role: "doctor" }).select(DOCTOR_FIELDS);
  const doctorIds = doctors.map((d) => d._id);

  const [nextAvailableRows, ratingRows] = await Promise.all([
    Availability.aggregate([
      { $match: { doctor: { $in: doctorIds }, isBooked: false, startTime: { $gte: new Date() } } },
      { $group: { _id: "$doctor", nextAvailable: { $min: "$startTime" } } },
    ]),
    Review.aggregate([
      { $match: { doctor: { $in: doctorIds } } },
      { $group: { _id: "$doctor", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ]),
  ]);

  const nextAvailableMap = new Map(nextAvailableRows.map((r) => [String(r._id), r.nextAvailable]));
  const ratingMap = new Map(ratingRows.map((r) => [String(r._id), r]));

  const enriched = doctors.map((doctor) => {
    const rating = ratingMap.get(String(doctor._id));
    return {
      ...doctor.toObject(),
      nextAvailable: nextAvailableMap.get(String(doctor._id)) || null,
      averageRating: rating ? Math.round(rating.averageRating * 10) / 10 : null,
      reviewCount: rating ? rating.reviewCount : 0,
    };
  });

  res.json(enriched);
});

const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "doctor" }).select(DOCTOR_FIELDS);

  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const [ratingRow] = await Review.aggregate([
    { $match: { doctor: doctor._id } },
    { $group: { _id: "$doctor", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]);

  res.json({
    ...doctor.toObject(),
    averageRating: ratingRow ? Math.round(ratingRow.averageRating * 10) / 10 : null,
    reviewCount: ratingRow ? ratingRow.reviewCount : 0,
  });
});

const getDoctorReviews = asyncHandler(async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: "doctor" });
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const reviews = await Review.find({ doctor: doctor._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("patientName rating comment createdAt");

  res.json(reviews);
});

const PROFILE_EDITABLE_FIELDS = [
  "name",
  "specialization",
  "location",
  "consultationType",
  "bio",
  "experience",
  "qualification",
  "consultationFee",
];

// Self-service profile editing -- deliberately excludes email/password,
// which need their own, more careful flows (email touches login identity;
// password change should require the current password).
const updateMyProfile = asyncHandler(async (req, res) => {
  const updates = {};
  PROFILE_EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    returnDocument: "after",
    runValidators: true,
  }).select(DOCTOR_FIELDS);

  res.json(user);
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

  await Appointment.deleteMany({ doctor: user._id });
  await Availability.deleteMany({ doctor: user._id });
  await user.deleteOne();

  res.json({ message: "User removed" });
});

module.exports = { getDoctors, getDoctorById, getDoctorReviews, updateMyProfile, getUsers, deleteUser };
