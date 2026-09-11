// One-off/re-runnable script to populate demo doctors, a week of
// availability, and a cross-matched set of appointment requests (with
// embedded patient contact info, matching the anonymous-booking model --
// there's no patient User to seed anymore). Safe to re-run: doctors are
// skipped if their email already exists, slot generation skips duplicates
// automatically (same unique-index behavior as the real /api/availability
// endpoint), and bookings dedupe on (phone, doctor, reason).
//
// Usage: cd server && node scripts/seed.js

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../src/models/User");
const Availability = require("../src/models/Availability");
const Appointment = require("../src/models/Appointment");
const generateReferenceNumber = require("../src/utils/generateReferenceNumber");
const notify = require("../src/utils/notify");

const DOCTORS = [
  {
    name: "Dr. Sarah Mitchell",
    email: "sarah.mitchell@myhealthschool-demo.com",
    specialization: "Cardiologist",
    location: "Downtown Clinic, New York, NY",
    consultationType: "both",
    bio: "15 years of experience in cardiovascular care, focused on preventive heart health.",
    experience: 15,
    qualification: "MBBS, MD (Cardiology)",
    consultationFee: 800,
  },
  {
    name: "Dr. James Okafor",
    email: "james.okafor@myhealthschool-demo.com",
    specialization: "General Physician",
    location: "Riverside Medical Center, Austin, TX",
    consultationType: "in-person",
    bio: "Board-certified family physician providing comprehensive primary care for all ages.",
    experience: 8,
    qualification: "MBBS, MD (General Medicine)",
    consultationFee: 500,
  },
  {
    name: "Dr. Priya Nair",
    email: "priya.nair@myhealthschool-demo.com",
    specialization: "Pediatrician",
    location: "Sunrise Children's Clinic, San Jose, CA",
    consultationType: "both",
    bio: "Dedicated to children's health from infancy through adolescence.",
    experience: 11,
    qualification: "MBBS, MD (Pediatrics)",
    consultationFee: 600,
  },
  {
    name: "Dr. Daniel Chen",
    email: "daniel.chen@myhealthschool-demo.com",
    specialization: "Dermatologist",
    location: "Lakeside Health Center, Seattle, WA",
    consultationType: "video",
    bio: "Specializes in skin health, offering convenient video consultations.",
    experience: 6,
    qualification: "MBBS, MD (Dermatology)",
    consultationFee: 700,
  },
  {
    name: "Dr. Robert Kim",
    email: "robert.kim@myhealthschool-demo.com",
    specialization: "Orthopedist",
    location: "Mountain View Ortho Center, Denver, CO",
    consultationType: "in-person",
    bio: "Focused on sports injuries, joint pain, and post-surgical rehabilitation.",
    experience: 13,
    qualification: "MBBS, MS (Orthopedics)",
    consultationFee: 750,
  },
  {
    name: "Dr. Fatima Al-Sayed",
    email: "fatima.alsayed@myhealthschool-demo.com",
    specialization: "Psychiatrist",
    location: "Wellness Mind Clinic, Chicago, IL",
    consultationType: "video",
    bio: "Helps patients manage anxiety, depression, and stress through evidence-based care.",
    experience: 9,
    qualification: "MBBS, MD (Psychiatry)",
    consultationFee: 650,
  },
  {
    name: "Dr. Lucas Bennett",
    email: "lucas.bennett@myhealthschool-demo.com",
    specialization: "ENT Specialist",
    location: "Harbor View Medical, Boston, MA",
    consultationType: "both",
    bio: "Treats ear, nose, and throat conditions for patients of all ages.",
    experience: 7,
    qualification: "MBBS, MS (ENT)",
    consultationFee: 550,
  },
  {
    name: "Dr. Olivia Martinez",
    email: "olivia.martinez@myhealthschool-demo.com",
    specialization: "Gynecologist",
    location: "Bright Start Women's Health, Miami, FL",
    consultationType: "in-person",
    bio: "Provides comprehensive women's health care across every life stage.",
    experience: 12,
    qualification: "MBBS, MD (Obstetrics & Gynecology)",
    consultationFee: 700,
  },
  {
    name: "Dr. Ahmed Hassan",
    email: "ahmed.hassan@myhealthschool-demo.com",
    specialization: "Endocrinologist",
    location: "Metro Diabetes & Hormone Center, Houston, TX",
    consultationType: "both",
    bio: "Specializes in diabetes, thyroid disorders, and hormonal health.",
    experience: 10,
    qualification: "MBBS, MD (Endocrinology)",
    consultationFee: 650,
  },
  {
    name: "Dr. Grace Park",
    email: "grace.park@myhealthschool-demo.com",
    specialization: "Ophthalmologist",
    location: "Clear Vision Eye Institute, Los Angeles, CA",
    consultationType: "in-person",
    bio: "Comprehensive eye care, from routine exams to advanced treatment.",
    experience: 14,
    qualification: "MBBS, MS (Ophthalmology)",
    consultationFee: 600,
  },
];

// Not Users -- there's no patient login anymore. This is just the embedded
// patientInfo used to generate realistic demo appointment requests, the same
// way a real anonymous booking would carry it.
const PATIENT_INFO_POOL = [
  { name: "Emily Carter", age: 34, gender: "female", phone: "9876500001", city: "New York" },
  { name: "Michael Torres", age: 41, gender: "male", phone: "9876500002", city: "Austin" },
  { name: "Aisha Rahman", age: 28, gender: "female", phone: "9876500003", city: "San Jose" },
  { name: "Liam Foster", age: 52, gender: "male", phone: "9876500004", city: "Seattle" },
  { name: "Sophia Nguyen", age: 23, gender: "female", phone: "9876500005", city: "Denver" },
  { name: "Noah Patel", age: 45, gender: "male", phone: "9876500006", city: "Chicago" },
  { name: "Ava Thompson", age: 31, gender: "female", phone: "9876500007", city: "Boston" },
  { name: "Ethan Wright", age: 38, gender: "male", phone: "9876500008", city: "Miami" },
  { name: "Isabella Garcia", age: 27, gender: "female", phone: "9876500009", city: "Houston" },
  { name: "Mason Clarke", age: 60, gender: "male", phone: "9876500010", city: "Los Angeles" },
];

// Reason pool per specialization, used to generate realistic (not-identical)
// booking reasons when cross-matching patients to doctors below.
const REASONS_BY_SPECIALIZATION = {
  Cardiologist: ["Annual heart checkup", "Chest pain evaluation", "Blood pressure follow-up"],
  "General Physician": ["General health checkup", "Flu-like symptoms", "Annual physical exam"],
  Pediatrician: ["Child wellness visit", "Vaccination checkup", "Fever and cough"],
  Dermatologist: ["Skin rash consultation", "Acne treatment follow-up", "Mole examination"],
  Orthopedist: ["Knee pain evaluation", "Lower back pain consultation", "Sports injury follow-up"],
  Psychiatrist: ["Anxiety management session", "Stress consultation", "Follow-up therapy session"],
  "ENT Specialist": ["Sinus consultation", "Ear pain evaluation", "Hearing test follow-up"],
  Gynecologist: ["Routine gynecological exam", "Prenatal checkup", "Follow-up consultation"],
  Endocrinologist: ["Diabetes management review", "Thyroid function follow-up", "Hormonal imbalance consultation"],
  Ophthalmologist: ["Routine eye exam", "Blurred vision evaluation", "Follow-up after eye treatment"],
};

const STATUS_ROTATION = ["pending", "confirmed", "completed", "cancelled", "rejected"];

const DEMO_PASSWORD = "password123";

const ensureDoctor = async ({ name, email, ...profile }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    // Backfill doctor profile fields added after this account was first seeded
    // (checks each field independently so later additions -- like experience --
    // get filled in even though earlier ones -- like specialization -- already are).
    const missing = Object.keys(profile).some((key) => existing[key] == null && profile[key] != null);
    if (missing) {
      Object.assign(existing, profile);
      await existing.save();
    }
    return existing;
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  return User.create({ name, email, password: hashedPassword, role: "doctor", ...profile });
};

const generateSlotsForDoctor = async (doctorId, daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(9, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(17, 0, 0, 0);

  const slots = [];
  let cursor = new Date(date);
  while (cursor < dayEnd) {
    const end = new Date(cursor.getTime() + 30 * 60000);
    slots.push({ doctor: doctorId, startTime: new Date(cursor), endTime: end });
    cursor = end;
  }

  try {
    await Availability.insertMany(slots, { ordered: false });
  } catch (error) {
    if (!(error.name === "MongoBulkWriteError" || error.code === 11000)) throw error;
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Seeding...");

  const doctors = [];
  for (const d of DOCTORS) {
    doctors.push(await ensureDoctor(d));
  }

  for (const doctor of doctors) {
    for (let day = 1; day <= 7; day++) {
      await generateSlotsForDoctor(doctor._id, day);
    }
  }
  console.log(`Ensured a week of availability slots for ${doctors.length} doctor(s).`);

  // Cross-match every patient to 3 different doctors (offsets 0/3/6 through the
  // doctor list, wrapping around) so bookings spread realistically across both
  // sides instead of piling onto a couple of accounts. Statuses rotate through
  // pending/confirmed/completed/cancelled/rejected for a realistic mix.
  // Idempotent per re-run: dedupes on (phone, doctor, reason).
  const bookings = [];
  PATIENT_INFO_POOL.forEach((patientInfo, i) => {
    [0, 3, 6].forEach((offset, j) => {
      const doctor = doctors[(i + offset) % doctors.length];
      const reasons = REASONS_BY_SPECIALIZATION[doctor.specialization] || ["General consultation"];
      bookings.push({
        patientInfo,
        doctor,
        reason: reasons[j % reasons.length],
        status: STATUS_ROTATION[(i * 3 + j) % STATUS_ROTATION.length],
      });
    });
  });

  let created = 0;
  for (const booking of bookings) {
    const exists = await Appointment.findOne({
      "patientInfo.phone": booking.patientInfo.phone,
      doctor: booking.doctor._id,
      reason: booking.reason,
    });
    if (exists) continue;

    const slot = await Availability.findOne({ doctor: booking.doctor._id, isBooked: false }).sort({
      startTime: 1,
    });
    if (!slot) continue;

    slot.isBooked = true;
    await slot.save();

    // Same derivation the real booking flow uses (createAppointment) -- not
    // fabricated, just the correct demo-payment state for a fee-charging
    // doctor. Never marked "paid": that status should only ever come from
    // someone actually exercising the demo pay flow.
    const payment =
      booking.doctor.consultationFee != null
        ? { status: "pending", amount: booking.doctor.consultationFee }
        : { status: "not_required" };

    const appointment = await Appointment.create({
      patientInfo: booking.patientInfo,
      doctor: booking.doctor._id,
      slot: slot._id,
      date: slot.startTime,
      reason: booking.reason,
      appointmentType: "in-person",
      referenceNumber: await generateReferenceNumber(),
      status: booking.status,
      payment,
    });

    // Gives the doctor's new notification bell real demo content, tied 1:1
    // to a real seeded appointment (not disconnected fake data).
    await notify({
      appointment,
      audience: "doctor",
      doctor: booking.doctor._id,
      event: "new_request",
      title: "New appointment request",
      message: `${booking.patientInfo.name} requested an appointment on ${appointment.date.toLocaleString()}.`,
    });

    // A cancelled/rejected appointment frees its slot back up, same as the
    // real updateAppointmentStatus controller does.
    if (booking.status === "cancelled" || booking.status === "rejected") {
      slot.isBooked = false;
      await slot.save();
    }
    created++;
  }
  console.log(`Ensured ${bookings.length} cross-doctor appointment requests (${created} newly created).`);

  console.log("\nDone. Demo doctor accounts (all use password: " + DEMO_PASSWORD + "):");
  doctors.forEach((d) => console.log(`  doctor  ${d.email}`));
  console.log("\nPatients don't have accounts -- appointment requests were seeded with embedded contact info.");

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
