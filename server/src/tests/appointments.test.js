const request = require("supertest");
const app = require("../app");

const registerAndGetCookie = async (overrides = {}) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      ...(overrides.role === "doctor" && { specialization: "General Physician" }),
      ...overrides,
    });
  return { cookie: res.headers["set-cookie"], userId: res.body.user.id };
};

describe("Appointments", () => {
  it("books a generated slot, then rejects a second attempt at the same slot", async () => {
    const doctor = await registerAndGetCookie({ email: "doc@example.com", role: "doctor" });
    const patient = await registerAndGetCookie({ email: "pat@example.com", role: "patient" });

    const gen = await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-01-15", startTime: "09:00", endTime: "10:00", slotMinutes: 30 });
    expect(gen.status).toBe(201);
    expect(gen.body.created).toBe(2);

    const slots = await request(app)
      .get(`/api/availability/${doctor.userId}?date=2027-01-15`)
      .set("Cookie", patient.cookie);
    expect(slots.body).toHaveLength(2);

    const slotId = slots.body[0]._id;

    const book = await request(app)
      .post("/api/appointments")
      .set("Cookie", patient.cookie)
      .send({ slotId, reason: "Checkup" });
    expect(book.status).toBe(201);

    const doubleBook = await request(app)
      .post("/api/appointments")
      .set("Cookie", patient.cookie)
      .send({ slotId, reason: "Trying again" });
    expect(doubleBook.status).toBe(409);
  });

  it("scopes appointment visibility by role", async () => {
    const doctorA = await registerAndGetCookie({ email: "doca@example.com", role: "doctor" });
    const doctorB = await registerAndGetCookie({ email: "docb@example.com", role: "doctor" });
    const patient = await registerAndGetCookie({ email: "patx@example.com", role: "patient" });

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctorA.cookie)
      .send({ date: "2027-01-16", startTime: "09:00", endTime: "09:30", slotMinutes: 30 });

    const slots = await request(app)
      .get(`/api/availability/${doctorA.userId}?date=2027-01-16`)
      .set("Cookie", patient.cookie);

    await request(app)
      .post("/api/appointments")
      .set("Cookie", patient.cookie)
      .send({ slotId: slots.body[0]._id, reason: "Checkup" });

    const asDoctorB = await request(app).get("/api/appointments").set("Cookie", doctorB.cookie);
    expect(asDoctorB.body).toHaveLength(0);

    const asDoctorA = await request(app).get("/api/appointments").set("Cookie", doctorA.cookie);
    expect(asDoctorA.body).toHaveLength(1);
  });

  it("only a doctor can confirm; a patient may only cancel their own", async () => {
    const doctor = await registerAndGetCookie({ email: "docz@example.com", role: "doctor" });
    const patient = await registerAndGetCookie({ email: "patz@example.com", role: "patient" });

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-01-17", startTime: "09:00", endTime: "09:30", slotMinutes: 30 });

    const slots = await request(app)
      .get(`/api/availability/${doctor.userId}?date=2027-01-17`)
      .set("Cookie", patient.cookie);

    const created = await request(app)
      .post("/api/appointments")
      .set("Cookie", patient.cookie)
      .send({ slotId: slots.body[0]._id, reason: "Checkup" });

    const patientConfirms = await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", patient.cookie)
      .send({ status: "confirmed" });
    expect(patientConfirms.status).toBe(403);

    const doctorConfirms = await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "confirmed" });
    expect(doctorConfirms.status).toBe(200);
    expect(doctorConfirms.body.status).toBe("confirmed");
  });

  it("frees the slot when a booked appointment is cancelled", async () => {
    const doctor = await registerAndGetCookie({ email: "docf@example.com", role: "doctor" });
    const patient = await registerAndGetCookie({ email: "patf@example.com", role: "patient" });

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-01-18", startTime: "09:00", endTime: "09:30", slotMinutes: 30 });

    const slots = await request(app)
      .get(`/api/availability/${doctor.userId}?date=2027-01-18`)
      .set("Cookie", patient.cookie);
    const slotId = slots.body[0]._id;

    const created = await request(app)
      .post("/api/appointments")
      .set("Cookie", patient.cookie)
      .send({ slotId, reason: "Checkup" });

    await request(app)
      .patch(`/api/appointments/${created.body._id}/status`)
      .set("Cookie", patient.cookie)
      .send({ status: "cancelled" });

    const slotsAfter = await request(app)
      .get(`/api/availability/${doctor.userId}?date=2027-01-18`)
      .set("Cookie", patient.cookie);
    expect(slotsAfter.body.map((s) => s._id)).toContain(slotId);
  });
});
