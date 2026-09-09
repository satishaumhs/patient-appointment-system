const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");

const getDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({ role: "doctor" }).select("name email");
  res.json(doctors);
});

module.exports = { getDoctors };
