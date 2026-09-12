const request = require("supertest");
const app = require("../app");
const Appointment = require("../models/Appointment");

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

  it("lets a patient cancel their own pending request by reference + phone, and blocks a second cancel", async () => {
    const doctor = await registerDoctor({ email: "docc@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-21", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-21");
    const slotId = slots.body[0]._id;
    const created = await bookAppointment(slotId, { patientInfo: samplePatientInfo({ phone: "9111111111" }) });
    const { referenceNumber } = created.body;

    const cancel = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/cancel`)
      .send({ phone: "9111111111" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("cancelled");

    const slotsAfter = await getSlots(doctor.userId, "2027-01-21");
    expect(slotsAfter.body.map((s) => s._id)).toContain(slotId);

    const secondCancel = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/cancel`)
      .send({ phone: "9111111111" });
    expect(secondCancel.status).toBe(400);
  });

  it("runs the demo payment flow for a fee-charging doctor and blocks paying twice", async () => {
    const doctor = await registerDoctor({ email: "docp@example.com", consultationFee: 500 });

    await genSlots(doctor.cookie, { date: "2027-01-22", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-22");
    const created = await bookAppointment(slots.body[0]._id, {
      patientInfo: samplePatientInfo({ phone: "9222222222" }),
    });
    expect(created.body.payment).toEqual({ status: "pending", amount: 500 });
    const { referenceNumber } = created.body;

    const pay = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/pay`)
      .send({ phone: "9222222222", method: "upi" });
    expect(pay.status).toBe(200);
    expect(pay.body.payment.status).toBe("paid");
    expect(pay.body.payment.amount).toBe(500);

    const payAgain = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/pay`)
      .send({ phone: "9222222222", method: "upi" });
    expect(payAgain.status).toBe(400);
  });

  it("only allows a review after the visit is completed, and rejects a duplicate", async () => {
    const doctor = await registerDoctor({ email: "docv@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-23", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-23");
    const created = await bookAppointment(slots.body[0]._id, {
      patientInfo: samplePatientInfo({ phone: "9333333333" }),
    });
    const { referenceNumber } = created.body;

    const tooEarly = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/review`)
      .send({ phone: "9333333333", rating: 5, comment: "Great visit" });
    expect(tooEarly.status).toBe(400);

    await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "confirmed" });
    await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "completed" });

    const review = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/review`)
      .send({ phone: "9333333333", rating: 5, comment: "Great visit" });
    expect(review.status).toBe(201);
    expect(review.body.patientName).toBe("Pat Test");

    const duplicate = await request(app)
      .post(`/api/appointments/status/${referenceNumber}/review`)
      .send({ phone: "9333333333", rating: 4 });
    expect(duplicate.status).toBe(400);
  });

  it("generates a video link only once a video appointment is confirmed", async () => {
    const doctor = await registerDoctor({ email: "docvid@example.com", consultationType: "video" });

    await genSlots(doctor.cookie, { date: "2027-01-24", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-24");
    const created = await bookAppointment(slots.body[0]._id, { appointmentType: "video" });
    expect(created.body.videoLink).toBeUndefined();

    const confirm = await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "confirmed" });
    expect(confirm.body.videoLink).toMatch(/^https:\/\/meet\.jit\.si\/MHS-\d{5}-/);

    // The frontend decides whether "Join video call" is offered by comparing
    // the slot's real end time against the current time -- both the doctor's
    // list and the patient's own lookup need that end time, not just a bare
    // slot id, or the join window can't be computed at all.
    const mine = await request(app).get("/api/appointments").set("Cookie", doctor.cookie);
    const listed = mine.body.find((a) => a._id === created.body._id);
    expect(listed.slot.endTime).toBe(slots.body[0].endTime);

    const lookup = await request(app)
      .post(`/api/appointments/status/${created.body.referenceNumber}`)
      .send({ phone: created.body.patientInfo.phone });
    expect(lookup.body.slot.endTime).toBe(slots.body[0].endTime);
  });

  it("reports queue position as the count of earlier confirmed visits with the same doctor that day", async () => {
    const doctor = await registerDoctor({ email: "docq@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-25", startTime: "09:00", endTime: "10:30" });
    const slots = await getSlots(doctor.userId, "2027-01-25");

    const first = await bookAppointment(slots.body[0]._id, { patientInfo: samplePatientInfo({ phone: "9001110001" }) });
    const second = await bookAppointment(slots.body[1]._id, { patientInfo: samplePatientInfo({ phone: "9001110002" }) });
    const third = await bookAppointment(slots.body[2]._id, { patientInfo: samplePatientInfo({ phone: "9001110003" }) });

    for (const created of [first, second, third]) {
      await request(app)
        .patch(`/api/appointments/${created.body._id}/status`)
        .set("Cookie", doctor.cookie)
        .send({ status: "confirmed" });
    }

    const lookupThird = await request(app)
      .post(`/api/appointments/status/${third.body.referenceNumber}`)
      .send({ phone: "9001110003" });
    expect(lookupThird.body.queuePosition).toBe(2);

    const lookupFirst = await request(app)
      .post(`/api/appointments/status/${first.body.referenceNumber}`)
      .send({ phone: "9001110001" });
    expect(lookupFirst.body.queuePosition).toBe(0);
  });

  it("lets a doctor mark a pay-at-clinic appointment as paid in cash, once, and only their own", async () => {
    const doctor = await registerDoctor({ email: "doccash@example.com", consultationFee: 400 });
    const otherDoctor = await registerDoctor({ email: "doccash2@example.com" });

    await genSlots(doctor.cookie, { date: "2027-01-26", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-26");
    const created = await bookAppointment(slots.body[0]._id, { patientInfo: samplePatientInfo({ phone: "9001110004" }) });
    expect(created.body.payment.status).toBe("pending");

    // Booking has to target a future slot, but "mark paid" is only meaningful
    // once the visit has actually happened -- push the stored date into the
    // past directly, the same way real time passing would.
    await Appointment.findByIdAndUpdate(created.body._id, { date: new Date(Date.now() - 60 * 60 * 1000) });

    const wrongDoctor = await request(app)
      .patch(`/api/appointments/${created.body._id}/mark-paid`)
      .set("Cookie", otherDoctor.cookie);
    expect(wrongDoctor.status).toBe(403);

    const marked = await request(app)
      .patch(`/api/appointments/${created.body._id}/mark-paid`)
      .set("Cookie", doctor.cookie);
    expect(marked.status).toBe(200);
    expect(marked.body.payment.status).toBe("paid");
    expect(marked.body.payment.method).toBe("cash");

    const again = await request(app)
      .patch(`/api/appointments/${created.body._id}/mark-paid`)
      .set("Cookie", doctor.cookie);
    expect(again.status).toBe(400);
  });

  it("rejects marking cash payment before the appointment date arrives", async () => {
    const doctor = await registerDoctor({ email: "doccash3@example.com", consultationFee: 400 });

    await genSlots(doctor.cookie, { date: "2027-01-27", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-27");
    const created = await bookAppointment(slots.body[0]._id, { patientInfo: samplePatientInfo({ phone: "9001110005" }) });

    const tooSoon = await request(app)
      .patch(`/api/appointments/${created.body._id}/mark-paid`)
      .set("Cookie", doctor.cookie);
    expect(tooSoon.status).toBe(400);
    expect(tooSoon.body.message).toMatch(/before the appointment date/);
  });

  it("rejects marking cash payment for a video appointment", async () => {
    const doctor = await registerDoctor({ email: "doccash4@example.com", consultationFee: 400 });

    await genSlots(doctor.cookie, { date: "2027-01-28", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-01-28");
    const created = await bookAppointment(slots.body[0]._id, {
      appointmentType: "video",
      patientInfo: samplePatientInfo({ phone: "9001110006" }),
    });
    await Appointment.findByIdAndUpdate(created.body._id, { date: new Date(Date.now() - 60 * 60 * 1000) });

    const rejected = await request(app)
      .patch(`/api/appointments/${created.body._id}/mark-paid`)
      .set("Cookie", doctor.cookie);
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toMatch(/video consultation/);
  });
});
