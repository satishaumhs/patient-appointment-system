const API = "http://localhost:5000/api";

const uniqueEmail = (label) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;

// Seeds data through the real API rather than the UI, for setup that isn't
// itself the behavior a spec is verifying (e.g. a doctor account needs to
// exist before "patient books an appointment with them" can be tested).
// Playwright's `request` fixture keeps its own cookie jar, so a doctor
// registered here stays authenticated for subsequent calls made with the
// same `request` object -- no manual cookie plumbing needed.
async function registerDoctor(request, overrides = {}) {
  const email = overrides.email || uniqueEmail("doctor");
  const password = overrides.password || "password123";
  const name = overrides.name || "Dr. E2E Test";

  const res = await request.post(`${API}/auth/register`, {
    data: {
      name,
      email,
      password,
      specialization: overrides.specialization || "General Physician",
      consultationType: overrides.consultationType || "in-person",
      // Payment only ever becomes "pending" on a booking when the doctor
      // has a fee set at all (see appointmentController.js's payment-on-
      // create logic) -- omitting this silently makes every booking
      // "not_required" regardless of appointmentType.
      consultationFee: overrides.consultationFee ?? 500,
    },
  });
  if (!res.ok()) throw new Error(`registerDoctor failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { id: body.user.id, name, email, password };
}

async function createSlot(request, { date, startTime = "09:00", endTime = "09:30", slotMinutes = 30 }) {
  const res = await request.post(`${API}/availability`, { data: { date, startTime, endTime, slotMinutes } });
  if (!res.ok()) throw new Error(`createSlot failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

async function getSlots(request, doctorId, date) {
  const res = await request.get(`${API}/availability/${doctorId}?date=${date}`);
  return res.json();
}

async function bookAppointment(request, { slotId, patientInfo, appointmentType = "in-person", reason = "" }) {
  const res = await request.post(`${API}/appointments`, { data: { slotId, appointmentType, reason, patientInfo } });
  if (!res.ok()) throw new Error(`bookAppointment failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

// A near-future date that's safely inside every window this app cares about
// and never in the past regardless of when the suite runs.
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

module.exports = { registerDoctor, createSlot, getSlots, bookAppointment, daysFromNow, uniqueEmail };
