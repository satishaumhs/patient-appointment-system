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
const generateVideoLink = require("../src/utils/generateVideoLink");
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
  {
    name: "Dr. Marcus Webb",
    email: "marcus.webb@myhealthschool-demo.com",
    specialization: "Neurologist",
    location: "Neuro Care Center, Philadelphia, PA",
    consultationType: "video",
    bio: "Diagnoses and treats disorders of the brain, spine, and nervous system.",
    experience: 16,
    qualification: "MBBS, DM (Neurology)",
    consultationFee: 900,
  },
  {
    name: "Dr. Elena Petrova",
    email: "elena.petrova@myhealthschool-demo.com",
    specialization: "Urologist",
    location: "Riverside Urology Clinic, Phoenix, AZ",
    consultationType: "in-person",
    bio: "Treats conditions of the urinary tract and male reproductive system.",
    experience: 12,
    qualification: "MBBS, MCh (Urology)",
    consultationFee: 750,
  },
  {
    name: "Dr. Samuel Osei",
    email: "samuel.osei@myhealthschool-demo.com",
    specialization: "Pulmonologist",
    location: "Clearbreath Lung Center, Atlanta, GA",
    consultationType: "both",
    bio: "Specializes in respiratory conditions including asthma and COPD.",
    experience: 10,
    qualification: "MBBS, MD (Pulmonology)",
    consultationFee: 700,
  },
  {
    name: "Dr. Hana Kobayashi",
    email: "hana.kobayashi@myhealthschool-demo.com",
    specialization: "Gastroenterologist",
    location: "Golden Gate Digestive Health, San Francisco, CA",
    consultationType: "in-person",
    bio: "Manages digestive system disorders from acid reflux to IBD.",
    experience: 14,
    qualification: "MBBS, DM (Gastroenterology)",
    consultationFee: 800,
  },
  {
    name: "Dr. Carlos Mendoza",
    email: "carlos.mendoza@myhealthschool-demo.com",
    specialization: "Rheumatologist",
    location: "Sunbelt Joint & Autoimmune Clinic, San Antonio, TX",
    consultationType: "video",
    bio: "Treats arthritis and other autoimmune joint conditions.",
    experience: 9,
    qualification: "MBBS, MD (Rheumatology)",
    consultationFee: 700,
  },
  {
    name: "Dr. Meera Iyer",
    email: "meera.iyer@myhealthschool-demo.com",
    specialization: "Nephrologist",
    location: "Riverbend Kidney Care, Charlotte, NC",
    consultationType: "both",
    bio: "Specializes in kidney health and chronic kidney disease management.",
    experience: 13,
    qualification: "MBBS, DM (Nephrology)",
    consultationFee: 750,
  },
  {
    name: "Dr. Benjamin Cole",
    email: "benjamin.cole@myhealthschool-demo.com",
    specialization: "Oncologist",
    location: "Hopewell Cancer Center, Minneapolis, MN",
    consultationType: "in-person",
    bio: "Provides compassionate, evidence-based cancer care and treatment planning.",
    experience: 18,
    qualification: "MBBS, DM (Oncology)",
    consultationFee: 1000,
  },
  {
    name: "Dr. Layla Haddad",
    email: "layla.haddad@myhealthschool-demo.com",
    specialization: "Allergist/Immunologist",
    location: "Clearwater Allergy & Asthma Center, Tampa, FL",
    consultationType: "video",
    bio: "Diagnoses and manages allergies, asthma, and immune disorders.",
    experience: 8,
    qualification: "MBBS, MD (Immunology)",
    consultationFee: 600,
  },
  {
    name: "Dr. Victor Alaniz",
    email: "victor.alaniz@myhealthschool-demo.com",
    specialization: "General Surgeon",
    location: "Summit Surgical Associates, Salt Lake City, UT",
    consultationType: "in-person",
    bio: "Performs a wide range of general and laparoscopic surgical procedures.",
    experience: 20,
    qualification: "MBBS, MS (General Surgery)",
    consultationFee: 900,
  },
  {
    name: "Dr. Naomi Adeyemi",
    email: "naomi.adeyemi@myhealthschool-demo.com",
    specialization: "Dentist",
    location: "Bright Smile Dental Studio, Portland, OR",
    consultationType: "in-person",
    bio: "Provides general and cosmetic dental care for the whole family.",
    experience: 7,
    qualification: "BDS, MDS",
    consultationFee: 450,
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
  { name: "Chloe Bennett", age: 29, gender: "female", phone: "9876500011", city: "Philadelphia" },
  { name: "Ryan O'Connell", age: 47, gender: "male", phone: "9876500012", city: "Phoenix" },
  { name: "Priyanka Desai", age: 33, gender: "female", phone: "9876500013", city: "Atlanta" },
  { name: "Kenji Watanabe", age: 55, gender: "male", phone: "9876500014", city: "San Francisco" },
  { name: "Valentina Ruiz", age: 24, gender: "female", phone: "9876500015", city: "San Antonio" },
  { name: "David Okonkwo", age: 39, gender: "male", phone: "9876500016", city: "Charlotte" },
  { name: "Grace Lindqvist", age: 63, gender: "female", phone: "9876500017", city: "Minneapolis" },
  { name: "Omar Farouk", age: 30, gender: "male", phone: "9876500018", city: "Tampa" },
  { name: "Jasmine Lee", age: 26, gender: "female", phone: "9876500019", city: "Salt Lake City" },
  { name: "Henry Dubois", age: 44, gender: "male", phone: "9876500020", city: "Portland" },
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
  Neurologist: ["Recurring headache evaluation", "Migraine follow-up", "Numbness and tingling consultation"],
  Urologist: ["Urinary tract symptoms", "Kidney stone follow-up", "Routine urology checkup"],
  Pulmonologist: ["Persistent cough evaluation", "Asthma management review", "Breathing difficulty consultation"],
  Gastroenterologist: ["Acid reflux consultation", "Abdominal pain evaluation", "Digestive health follow-up"],
  Rheumatologist: ["Joint pain evaluation", "Arthritis management review", "Autoimmune follow-up"],
  Nephrologist: ["Kidney function review", "Chronic kidney disease follow-up", "Routine nephrology checkup"],
  Oncologist: ["Follow-up cancer screening", "Treatment planning consultation", "Post-treatment review"],
  "Allergist/Immunologist": ["Seasonal allergy consultation", "Asthma follow-up", "Food allergy evaluation"],
  "General Surgeon": ["Pre-surgical consultation", "Post-operative follow-up", "Hernia evaluation"],
  Dentist: ["Routine dental checkup", "Tooth pain consultation", "Follow-up after dental procedure"],
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

  // Cross-match every patient to 4 different doctors (offsets 0/5/10/15
  // through the doctor list, wrapping around) so bookings spread realistically
  // across all 20 doctors instead of piling onto a couple of accounts.
  // Statuses rotate through pending/confirmed/completed/cancelled/rejected for
  // a realistic mix. Idempotent per re-run: dedupes on (phone, doctor, reason).
  const bookings = [];
  PATIENT_INFO_POOL.forEach((patientInfo, i) => {
    [0, 5, 10, 15].forEach((offset, j) => {
      const doctor = doctors[(i + offset) % doctors.length];
      const reasons = REASONS_BY_SPECIALIZATION[doctor.specialization] || ["General consultation"];
      // A "both" doctor's bookings alternate type instead of defaulting to
      // in-person for everyone -- a video-only doctor's history should never
      // show an in-person visit, and a both-doctor's should show a mix.
      const appointmentType =
        doctor.consultationType === "video" || (doctor.consultationType === "both" && j % 2 === 1)
          ? "video"
          : "in-person";
      bookings.push({
        patientInfo,
        doctor,
        reason: reasons[j % reasons.length],
        status: STATUS_ROTATION[(i * 4 + j) % STATUS_ROTATION.length],
        appointmentType,
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

    const referenceNumber = await generateReferenceNumber();
    // Same rule the real updateAppointmentStatus controller applies -- a
    // video link only exists once a video appointment is actually confirmed.
    const videoLink =
      booking.appointmentType === "video" && ["confirmed", "completed"].includes(booking.status)
        ? generateVideoLink(referenceNumber)
        : undefined;

    const appointment = await Appointment.create({
      patientInfo: booking.patientInfo,
      doctor: booking.doctor._id,
      slot: slot._id,
      date: slot.startTime,
      reason: booking.reason,
      appointmentType: booking.appointmentType,
      referenceNumber,
      status: booking.status,
      payment,
      videoLink,
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

  console.log(`\nDone. ${doctors.length} demo doctor accounts (all use password: ${DEMO_PASSWORD}):`);
  doctors.forEach((d) => console.log(`  ${d.name.padEnd(24)} ${d.specialization.padEnd(24)} ${d.email}`));
  console.log("\nPatients don't have accounts -- appointment requests were seeded with embedded contact info.");

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
