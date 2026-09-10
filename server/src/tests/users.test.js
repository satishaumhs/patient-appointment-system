const request = require("supertest");
const app = require("../app");
const User = require("../models/User");

const registerAndGetCookie = async (overrides = {}) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      specialization: "General Physician",
      ...overrides,
    });
  return { cookie: res.headers["set-cookie"], userId: res.body.user.id };
};

describe("Admin user management", () => {
  it("blocks non-admins from listing users", async () => {
    const doctor = await registerAndGetCookie({ email: "p@example.com" });
    const res = await request(app).get("/api/users").set("Cookie", doctor.cookie);
    expect(res.status).toBe(403);
  });

  it("lets an admin list and delete users, but not delete themselves", async () => {
    const target = await registerAndGetCookie({ email: "victim@example.com" });
    const admin = await registerAndGetCookie({ email: "admin@example.com" });
    await User.findByIdAndUpdate(admin.userId, { role: "admin" });

    const list = await request(app).get("/api/users").set("Cookie", admin.cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const selfDelete = await request(app)
      .delete(`/api/users/${admin.userId}`)
      .set("Cookie", admin.cookie);
    expect(selfDelete.status).toBe(400);

    const del = await request(app).delete(`/api/users/${target.userId}`).set("Cookie", admin.cookie);
    expect(del.status).toBe(200);
  });
});
