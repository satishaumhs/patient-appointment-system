// One-off/re-runnable script to populate demo doctors, patients, a week of
// availability, and a cross-matched set of appointments spread across many
// different patients and doctors. Safe to re-run: users are skipped if their
// email already exists, slot generation skips duplicates automatically (same
// unique-index behavior as the real /api/availability endpoint), and bookings
// dedupe on (patient, doctor, reason).
//
// Usage: cd server && node scripts/seed.js

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../src/models/User");
const Availability = require("../src/models/Availability");
const Appointment = require("../src/models/Appointment");

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

const PATIENTS = [
  { name: "Emily Carter", email: "emily.carter@myhealthschool-demo.com" },
  { name: "Michael Torres", email: "michael.torres@myhealthschool-demo.com" },
  { name: "Aisha Rahman", email: "aisha.rahman@myhealthschool-demo.com" },
  { name: "Liam Foster", email: "liam.foster@myhealthschool-demo.com" },
  { name: "Sophia Nguyen", email: "sophia.nguyen@myhealthschool-demo.com" },
  { name: "Noah Patel", email: "noah.patel@myhealthschool-demo.com" },
  { name: "Ava Thompson", email: "ava.thompson@myhealthschool-demo.com" },
  { name: "Ethan Wright", email: "ethan.wright@myhealthschool-demo.com" },
  { name: "Isabella Garcia", email: "isabella.garcia@myhealthschool-demo.com" },
  { name: "Mason Clarke", email: "mason.clarke@myhealthschool-demo.com" },
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

const STATUS_ROTATION = ["pending", "confirmed", "completed", "cancelled"];

const DEMO_PASSWORD = "password123";

const ensureUser = async ({ name, email, role, ...profile }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    // Backfill doctor profile fields added after this account was first seeded
    // (checks each field independently so later additions -- like experience --
    // get filled in even though earlier ones -- like specialization -- already are).
    if (role === "doctor") {
      const missing = Object.keys(profile).some((key) => existing[key] == null && profile[key] != null);
      if (missing) {
        Object.assign(existing, profile);
        await existing.save();
      }
    }
    return existing;
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  return User.create({ name, email, password: hashedPassword, role, ...profile });
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
    doctors.push(await ensureUser({ ...d, role: "doctor" }));
  }

  const patients = [];
  for (const p of PATIENTS) {
    patients.push(await ensureUser({ ...p, role: "patient" }));
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
  // pending/confirmed/completed/cancelled for a realistic mix. Idempotent per
  // re-run: dedupes on the (patient, doctor, reason) triple rather than "this
  // patient already has an appointment," since each patient now has several.
  const bookings = [];
  patients.forEach((patient, i) => {
    [0, 3, 6].forEach((offset, j) => {
      const doctor = doctors[(i + offset) % doctors.length];
      const reasons = REASONS_BY_SPECIALIZATION[doctor.specialization] || ["General consultation"];
      bookings.push({
        patient,
        doctor,
        reason: reasons[j % reasons.length],
        status: STATUS_ROTATION[(i * 3 + j) % STATUS_ROTATION.length],
      });
    });
  });

  let created = 0;
  for (const booking of bookings) {
    const exists = await Appointment.findOne({
      patient: booking.patient._id,
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

    await Appointment.create({
      patient: booking.patient._id,
      doctor: booking.doctor._id,
      slot: slot._id,
      date: slot.startTime,
      reason: booking.reason,
      status: booking.status,
    });

    // A cancelled appointment frees its slot back up, same as the real
    // updateAppointmentStatus controller does.
    if (booking.status === "cancelled") {
      slot.isBooked = false;
      await slot.save();
    }
    created++;
  }
  console.log(`Ensured ${bookings.length} cross-doctor appointments (${created} newly created).`);

  console.log("\nDone. Demo accounts (all use password: " + DEMO_PASSWORD + "):");
  doctors.forEach((d) => console.log(`  doctor  ${d.email}`));
  patients.forEach((p) => console.log(`  patient ${p.email}`));

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
