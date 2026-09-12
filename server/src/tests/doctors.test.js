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

describe("Doctor self-service profile edit", () => {
  it("lets a doctor update their own profile fields, but not email or role", async () => {
    const doctor = await registerDoctor({ email: "editme@example.com", specialization: "Cardiologist" });

    const res = await request(app)
      .patch("/api/users/me")
      .set("Cookie", doctor.cookie)
      .send({
        bio: "Updated bio",
        consultationFee: 999,
        email: "hacked@example.com",
        role: "admin",
      });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Updated bio");
    expect(res.body.consultationFee).toBe(999);
    expect(res.body.email).toBe("editme@example.com");

    const stored = await User.findById(doctor.userId);
    expect(stored.role).toBe("doctor");
    expect(stored.email).toBe("editme@example.com");
  });

  it("requires login and a doctor role to edit a profile", async () => {
    const anonymous = await request(app).patch("/api/users/me").send({ bio: "x" });
    expect(anonymous.status).toBe(401);
  });
});
