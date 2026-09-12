const request = require("supertest");
const app = require("../app");
const User = require("../models/User");

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

describe("Waitlist", () => {
  it("lets a patient join a doctor's waitlist and lets the doctor see who's waiting", async () => {
    const doctor = await registerDoctor({ email: "docwl@example.com" });

    const join = await request(app)
      .post("/api/waitlist")
      .send({ doctorId: doctor.userId, name: "Waiting Patient", phone: "9887766554" });
    expect(join.status).toBe(201);
    expect(join.body.waitlistCode).toMatch(/^WL-\d{5}$/);

    const mine = await request(app).get("/api/waitlist/mine").set("Cookie", doctor.cookie);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].name).toBe("Waiting Patient");
  });

  it("flips waitlist entries to notified once the doctor opens new slots", async () => {
    const doctor = await registerDoctor({ email: "docwl2@example.com" });

    await request(app)
      .post("/api/waitlist")
      .send({ doctorId: doctor.userId, name: "First In Line", phone: "9887766555" });

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-03-01", startTime: "09:00", endTime: "09:30", slotMinutes: 30 });

    const mine = await request(app).get("/api/waitlist/mine").set("Cookie", doctor.cookie);
    expect(mine.body).toHaveLength(0); // notified entries drop out of the "waiting" list
  });

  it("rejects joining a waitlist for a doctor that doesn't exist", async () => {
    const res = await request(app)
      .post("/api/waitlist")
      .send({ doctorId: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Nobody", phone: "9887766556" });
    expect(res.status).toBe(404);
  });

  it("lets a patient leave a waitlist using their code and phone", async () => {
    const doctor = await registerDoctor({ email: "docwl3@example.com" });

    const join = await request(app)
      .post("/api/waitlist")
      .send({ doctorId: doctor.userId, name: "Changed Mind", phone: "9887766557" });

    const leave = await request(app)
      .delete(`/api/waitlist/${join.body.waitlistCode}`)
      .send({ phone: "9887766557" });
    expect(leave.status).toBe(200);

    const mine = await request(app).get("/api/waitlist/mine").set("Cookie", doctor.cookie);
    expect(mine.body).toHaveLength(0);
  });

  it("gives an identical response for an unknown code and a wrong phone, so neither can be used to fish for the other", async () => {
    const doctor = await registerDoctor({ email: "docwl4@example.com" });

    const join = await request(app)
      .post("/api/waitlist")
      .send({ doctorId: doctor.userId, name: "Real Entry", phone: "9887766558" });

    const wrongPhone = await request(app)
      .delete(`/api/waitlist/${join.body.waitlistCode}`)
      .send({ phone: "9887766559" });
    const unknownCode = await request(app).delete("/api/waitlist/WL-00000").send({ phone: "9887766559" });

    expect(wrongPhone.status).toBe(unknownCode.status);
    expect(wrongPhone.body).toEqual(unknownCode.body);

    // the real entry is untouched by the failed attempt
    const mine = await request(app).get("/api/waitlist/mine").set("Cookie", doctor.cookie);
    expect(mine.body).toHaveLength(1);
  });

  it("lets an admin see waitlist demand across every doctor, but not a plain doctor", async () => {
    const doctorA = await registerDoctor({ email: "docwl5@example.com" });
    const doctorB = await registerDoctor({ email: "docwl6@example.com", specialization: "Dermatologist" });
    await User.findByIdAndUpdate(doctorA.userId, { role: "admin" });

    await request(app)
      .post("/api/waitlist")
      .send({ doctorId: doctorB.userId, name: "Waiting For B", phone: "9887766560" });

    const asAdmin = await request(app).get("/api/waitlist").set("Cookie", doctorA.cookie);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toHaveLength(1);
    expect(asAdmin.body[0].doctor.name).toBe("Test Doctor");

    const asDoctor = await request(app).get("/api/waitlist").set("Cookie", doctorB.cookie);
    expect(asDoctor.status).toBe(403);
  });
});
