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
});
