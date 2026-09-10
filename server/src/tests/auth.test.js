const request = require("supertest");
const app = require("../app");

describe("Auth", () => {
  it("registers a new doctor and sets a session cookie", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
      specialization: "Cardiologist",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("doctor");
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.headers["set-cookie"][0]).toMatch(/token=/);
  });

  it("rejects duplicate email registration", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
      specialization: "Cardiologist",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Alice Again",
      email: "alice@example.com",
      password: "password123",
      specialization: "Cardiologist",
    });

    expect(res.status).toBe(400);
  });

  it("ignores a requested admin role -- self-registration always creates a doctor", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Sneaky",
      email: "sneaky@example.com",
      password: "password123",
      specialization: "Cardiologist",
      role: "admin",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("doctor");
  });

  it("requires a specialization to register", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Dr. No Spec",
      email: "nospec@example.com",
      password: "password123",
    });

    expect(res.status).toBe(400);

    const withSpec = await request(app).post("/api/auth/register").send({
      name: "Dr. Has Spec",
      email: "hasspec@example.com",
      password: "password123",
      specialization: "Cardiologist",
    });

    expect(withSpec.status).toBe(201);
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Bob",
      email: "bob@example.com",
      password: "password123",
      specialization: "Cardiologist",
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
