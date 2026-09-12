const asyncHandler = require("../utils/asyncHandler");
const Waitlist = require("../models/Waitlist");
const User = require("../models/User");
const generateWaitlistCode = require("../utils/generateWaitlistCode");

const joinWaitlist = asyncHandler(async (req, res) => {
  const { doctorId, name, phone, email } = req.body;

  const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const waitlistCode = await generateWaitlistCode();
  const entry = await Waitlist.create({ doctor: doctorId, name, phone, email, waitlistCode });

  res.status(201).json({ waitlistCode: entry.waitlistCode, doctor: { name: doctor.name } });
});

// Doctor-only: see who's waiting, so a fully-booked doctor can see there's
// real demand for more slots.
const getMyWaitlist = asyncHandler(async (req, res) => {
  const entries = await Waitlist.find({ doctor: req.user._id, status: "waiting" })
    .sort({ createdAt: 1 })
    .select("name phone createdAt");

  res.json(entries);
});

// Not a route -- called from the appointment/availability controllers
// whenever a slot opens up for a doctor (new slots generated, or an
// existing one freed by a cancellation/rejection/unblock). Pull-based: no
// SMS/WhatsApp provider is configured, so "notified" means a demo email log
// fires (if the patient gave one) and the entry flips to notified; the
// patient's real confirmation is revisiting the doctor's profile page.
const notifyWaitlist = async (doctorId) => {
  const waiting = await Waitlist.find({ doctor: doctorId, status: "waiting" });
  if (waiting.length === 0) return;

  await Waitlist.updateMany(
    { _id: { $in: waiting.map((w) => w._id) } },
    { status: "notified", notifiedAt: new Date() }
  );

  waiting.forEach((entry) => {
    if (entry.email) {
      console.log(`[DEMO EMAIL] to ${entry.email}: A new slot opened up -- book before it's taken again.`);
    }
  });
};

module.exports = { joinWaitlist, getMyWaitlist, notifyWaitlist };
