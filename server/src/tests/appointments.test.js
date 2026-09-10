const request = require("supertest");
const app = require("../app");

const registerDoctor = async (overrides = {}) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Test Doctor",
      email: "test@example.com",
      password: "password123",
      specialization: "General Physician",
      ...overrides,
    });
  return { cookie: res.headers["set-cookie"], userId: res.body.user.id };
};

const genSlots = (doctorCookie, { date, startTime = "09:00", endTime = "10:00", slotMinutes = 30 }) =>
  request(app)
    .post("/api/availability")
    .set("Cookie", doctorCookie)
    .send({ date, startTime, endTime, slotMinutes });

const getSlots = (doctorId, date) => request(app).get(`/api/availability/${doctorId}?date=${date}`);

const samplePatientInfo = (overrides = {}) => ({
  name: "Pat Test",
  age: 30,
  gender: "female",
  phone: "9998887770",
  ...overrides,
});

const bookAppointment = (slotId, overrides = {}) =>
  request(app)
    .post("/api/appointments")
    .send({ slotId, reason: "Checkup", patientInfo: samplePatientInfo(), ...overrides });

describe("Appointments", () => {
  it("books a generated slot anonymously (no login), then rejects a second attempt at the same slot", async () => {
    const doctor = await registerDoctor({ email: "doc@example.com" });

    const gen = await genSlots(doctor.cookie, { date: "2027-01-15" });
    expect(gen.status).toBe(201);
    expect(gen.body.created).toBe(2);

    const slots = await getSlots(doctor.userId, "2027-01-15");
    expect(slots.body).toHaveLength(2);

    const slotId = slots.body[0]._id;

    const book = await bookAppointment(slotId);
    expect(book.status).toBe(201);
    expect(book.body.referenceNumber).toMatch(/^MHS-\d{5}$/);

    const doubleBook = await bookAppointment(slotId, { reason: "Trying again" });
    expect(doubleBook.status).toBe(409);
  });

  it("scopes appointment visibility to the owning doctor", async () => {
    const doctorA = await registerDoctor({ email: "doca@example.com" });
    const doctorB = await registerDoctor({ email: "docb@example.com" });

    await genSlots(doctorA.cookie, { date: "2027-01-16", endTime: "09:30" });
    const slots = await getSlots(doctorA.userId, "2027-01-16");
    await bookAppointment(slots.body[0]._id);

    const asDoctorB = await request(app).get("/api/appointments").set("Cookie", doctorB.cookie);
    expect(asDoctorB.body).toHaveLength(0);

    const asDoctorA = await request(app).get("/api/appointments").set("Cookie", doctorA.cookie);
    expect(asDoctorA.body).toHaveLength(1);
  });

  it("requires login to update status, and only the owning doctor (or admin) may do it", async () => {
    const doctor = await registerDoctor({ email: "docz@example.com" });
    const otherDoctor = await registerDoctor({ email: "docz2@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-17", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-17");
    const created = await bookAppointment(slots.body[0]._id);

    const anonymous = await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .send({ status: "confirmed" });
    expect(anonymous.status).toBe(401);

    const wrongDoctor = await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", otherDoctor.cookie)
      .send({ status: "confirmed" });
    expect(wrongDoctor.status).toBe(403);

    const owningDoctor = await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "confirmed" });
    expect(owningDoctor.status).toBe(200);
    expect(owningDoctor.body.status).toBe("confirmed");
  });

  it("frees the slot when a doctor rejects or cancels an appointment", async () => {
    const doctor = await registerDoctor({ email: "docf@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-18", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-18");
    const slotId = slots.body[0]._id;

    const created = await bookAppointment(slotId);

    await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "rejected" });

    const slotsAfter = await getSlots(doctor.userId, "2027-01-18");
    expect(slotsAfter.body.map((s) => s._id)).toContain(slotId);
  });

  it("reschedules to a different slot for the same doctor, and rejects moving to another doctor's slot", async () => {
    const doctor = await registerDoctor({ email: "docr@example.com" });
    const otherDoctor = await registerDoctor({ email: "docr2@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-19", startTime: "09:00", endTime: "10:00" });
    const slots = await getSlots(doctor.userId, "2027-01-19");
    const created = await bookAppointment(slots.body[0]._id);

    await genSlots(otherDoctor.cookie, { date: "2027-01-19", endTime: "09:30" });
    const otherSlots = await getSlots(otherDoctor.userId, "2027-01-19");

    const crossDoctor = await request(app)
      .patch(`/api/appointments/${created.body._id}/reschedule`)
      .set("Cookie", doctor.cookie)
      .send({ newSlotId: otherSlots.body[0]._id });
    expect(crossDoctor.status).toBe(409);

    const reschedule = await request(app)
      .patch(`/api/appointments/${created.body._id}/reschedule`)
      .set("Cookie", doctor.cookie)
      .send({ newSlotId: slots.body[1]._id });
    expect(reschedule.status).toBe(200);
    expect(reschedule.body.status).toBe("confirmed");
    expect(reschedule.body.slot).toBe(slots.body[1]._id);
  });

  it("looks up an appointment by reference number + phone, returning an identical response whether the reference is unknown or the phone is wrong", async () => {
    const doctor = await registerDoctor({ email: "docs@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-20", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-20");
    const created = await bookAppointment(slots.body[0]._id, {
      patientInfo: samplePatientInfo({ phone: "9123456789" }),
    });
    const { referenceNumber } = created.body;

    const correct = await request(app)
      .post(`/api/appointments/status/${referenceNumber}`)
      .send({ phone: "9123456789" });
    expect(correct.status).toBe(200);
    expect(correct.body.referenceNumber).toBe(referenceNumber);
    expect(correct.body.reason).toBeUndefined();

    const wrongPhone = await request(app)
      .post(`/api/appointments/status/${referenceNumber}`)
      .send({ phone: "9000000000" });
    const unknownRef = await request(app)
      .post(`/api/appointments/status/MHS-00000`)
      .send({ phone: "9123456789" });

    expect(wrongPhone.status).toBe(unknownRef.status);
    expect(wrongPhone.body).toEqual(unknownRef.body);
  });
});
