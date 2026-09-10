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

describe("Doctor directory", () => {
  it("lists doctors with their profile fields -- publicly, no login required", async () => {
    await registerDoctor({
      email: "doc@example.com",
      specialization: "Dermatologist",
      location: "Test City",
    });

    const res = await request(app).get("/api/users/doctors");

    expect(res.status).toBe(200);
    const doc = res.body.find((d) => d.email === "doc@example.com");
    expect(doc.specialization).toBe("Dermatologist");
    expect(doc.location).toBe("Test City");
    expect(doc.password).toBeUndefined();
  });

  it("fetches a single doctor profile publicly, and 404s for a non-doctor id", async () => {
    const doctor = await registerDoctor({
      email: "doc2@example.com",
      specialization: "Pediatrician",
    });
    const admin = await registerDoctor({ email: "admin2@example.com" });
    await User.findByIdAndUpdate(admin.userId, { role: "admin" });

    const found = await request(app).get(`/api/users/doctors/${doctor.userId}`);
    expect(found.status).toBe(200);
    expect(found.body.specialization).toBe("Pediatrician");

    const notADoctor = await request(app).get(`/api/users/doctors/${admin.userId}`);
    expect(notADoctor.status).toBe(404);
  });
});
