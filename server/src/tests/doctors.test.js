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

describe("Doctor directory", () => {
  it("lists doctors with their profile fields", async () => {
    const patient = await registerAndGetCookie({ email: "p@example.com" });
    await registerAndGetCookie({
      email: "doc@example.com",
      role: "doctor",
      specialization: "Dermatologist",
      location: "Test City",
    });

    const res = await request(app).get("/api/users/doctors").set("Cookie", patient.cookie);

    expect(res.status).toBe(200);
    const doc = res.body.find((d) => d.email === "doc@example.com");
    expect(doc.specialization).toBe("Dermatologist");
    expect(doc.location).toBe("Test City");
    expect(doc.password).toBeUndefined();
  });

  it("fetches a single doctor profile, and 404s for a non-doctor id", async () => {
    const patient = await registerAndGetCookie({ email: "p2@example.com" });
    const doctor = await registerAndGetCookie({
      email: "doc2@example.com",
      role: "doctor",
      specialization: "Pediatrician",
    });

    const found = await request(app)
      .get(`/api/users/doctors/${doctor.userId}`)
      .set("Cookie", patient.cookie);
    expect(found.status).toBe(200);
    expect(found.body.specialization).toBe("Pediatrician");

    const notADoctor = await request(app)
      .get(`/api/users/doctors/${patient.userId}`)
      .set("Cookie", patient.cookie);
    expect(notADoctor.status).toBe(404);
  });
});
