const request = require("supertest");
const app = require("../app");

describe("Auth", () => {
  it("registers a new patient and sets a session cookie", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("patient");
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.headers["set-cookie"][0]).toMatch(/token=/);
  });

  it("rejects duplicate email registration", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Alice Again",
      email: "alice@example.com",
      password: "password123",
    });

    expect(res.status).toBe(400);
  });

  it("rejects self-registration as admin", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Sneaky",
      email: "sneaky@example.com",
      password: "password123",
      role: "admin",
    });

    expect(res.status).toBe(400);
  });

  it("requires a specialization for doctor registration", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Dr. No Spec",
      email: "nospec@example.com",
      password: "password123",
      role: "doctor",
    });

    expect(res.status).toBe(400);

    const withSpec = await request(app).post("/api/auth/register").send({
      name: "Dr. Has Spec",
      email: "hasspec@example.com",
      password: "password123",
      role: "doctor",
      specialization: "Cardiologist",
    });

    expect(withSpec.status).toBe(201);
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Bob",
      email: "bob@example.com",
      password: "password123",
    });

    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "password123" });
    expect(good.status).toBe(200);

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "wrongpassword" });
    expect(bad.status).toBe(401);
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
