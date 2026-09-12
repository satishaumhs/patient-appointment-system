const request = require("supertest");
const bcrypt = require("bcryptjs");
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

const makeAdmin = async () => {
  const hashedPassword = await bcrypt.hash("password123", 10);
  await User.create({ name: "Admin", email: "admin@example.com", password: hashedPassword, role: "admin" });
  const res = await request(app).post("/api/auth/login").send({ email: "admin@example.com", password: "password123" });
  return res.headers["set-cookie"];
};

describe("Admin analytics", () => {
  it("rejects non-admin access", async () => {
    const doctor = await registerDoctor({ email: "docan@example.com" });
    const res = await request(app).get("/api/analytics").set("Cookie", doctor.cookie);
    expect(res.status).toBe(403);
  });

  it("returns real aggregated revenue, hour buckets, and no-show rate", async () => {
    const doctor = await registerDoctor({ email: "docan2@example.com", consultationFee: 500 });
    const adminCookie = await makeAdmin();

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-05-01", startTime: "14:00", endTime: "15:00", slotMinutes: 30 });
    const slots = await request(app).get(`/api/availability/${doctor.userId}?date=2027-05-01`);

    const booked = await request(app)
      .post("/api/appointments")
      .send({ slotId: slots.body[0]._id, patientInfo: { name: "Pat", age: 30, gender: "male", phone: "9112233440" } });

    await request(app)
      .post(`/api/appointments/status/${booked.body.referenceNumber}/pay`)
      .send({ phone: "9112233440", method: "card" });

    await request(app)
      .patch(`/api/appointments/${booked.body._id}/status`)
      .set("Cookie", doctor.cookie)
      .send({ status: "rejected" });

    const analytics = await request(app).get("/api/analytics").set("Cookie", adminCookie);
    expect(analytics.status).toBe(200);
    expect(analytics.body.totalAppointments).toBeGreaterThanOrEqual(1);
    expect(analytics.body.revenueBySpecialization[0]).toMatchObject({
      specialization: "General Physician",
      revenue: 500,
    });
    expect(analytics.body.busiestHours.some((h) => h.hour === 14)).toBe(true);
    expect(analytics.body.noShowRate).toBeGreaterThan(0);
  });
});
