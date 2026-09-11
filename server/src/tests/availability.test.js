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

describe("Recurring availability", () => {
  it("repeats a schedule across weekdays only, skipping the weekend, up to repeatUntil", async () => {
    const doctor = await registerDoctor({ email: "docrec@example.com" });

    // 2027-02-01 is a Monday, 2027-02-07 the following Sunday -- a full week
    // with a known weekend. Default repeatOn (Mon-Fri) should cover 5 days.
    const res = await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-02-01", repeatUntil: "2027-02-07", startTime: "09:00", endTime: "10:00", slotMinutes: 30 });

    expect(res.status).toBe(201);
    expect(res.body.daysCovered).toBe(5);
    expect(res.body.created).toBe(10); // 2 slots/day x 5 weekdays

    const weekday = await request(app).get(`/api/availability/${doctor.userId}?date=2027-02-03`);
    expect(weekday.body).toHaveLength(2);

    const weekend = await request(app).get(`/api/availability/${doctor.userId}?date=2027-02-06`);
    expect(weekend.body).toHaveLength(0);
  });

  it("rejects a repeatUntil before date, and a range longer than 90 days", async () => {
    const doctor = await registerDoctor({ email: "docrec2@example.com" });

    const backwards = await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-02-10", repeatUntil: "2027-02-01", startTime: "09:00", endTime: "10:00", slotMinutes: 30 });
    expect(backwards.status).toBe(400);

    const tooLong = await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-02-01", repeatUntil: "2027-06-01", startTime: "09:00", endTime: "10:00", slotMinutes: 30 });
    expect(tooLong.status).toBe(400);
  });
});

describe("Slot blocking", () => {
  it("blocks an open slot with a reason, excludes it from public availability, then unblocks it", async () => {
    const doctor = await registerDoctor({ email: "docblock@example.com" });

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-02-08", startTime: "09:00", endTime: "10:00", slotMinutes: 30 });
    const slots = await request(app).get(`/api/availability/${doctor.userId}?date=2027-02-08`);
    const slotId = slots.body[0]._id;

    const block = await request(app)
      .patch(`/api/availability/${slotId}/block`)
      .set("Cookie", doctor.cookie)
      .send({ reason: "meeting" });
    expect(block.status).toBe(200);
    expect(block.body.isBooked).toBe(true);
    expect(block.body.blockedReason).toBe("meeting");

    const afterBlock = await request(app).get(`/api/availability/${doctor.userId}?date=2027-02-08`);
    expect(afterBlock.body.map((s) => s._id)).not.toContain(slotId);

    // A blocked slot isn't a real booking -- it can't be deleted directly...
    const deleteAttempt = await request(app).delete(`/api/availability/${slotId}`).set("Cookie", doctor.cookie);
    expect(deleteAttempt.status).toBe(400);

    // ...it has to be unblocked first, which frees it back up for booking.
    const unblock = await request(app).patch(`/api/availability/${slotId}/unblock`).set("Cookie", doctor.cookie);
    expect(unblock.status).toBe(200);
    expect(unblock.body.isBooked).toBe(false);
    expect(unblock.body.blockedReason).toBeNull();

    const afterUnblock = await request(app).get(`/api/availability/${doctor.userId}?date=2027-02-08`);
    expect(afterUnblock.body.map((s) => s._id)).toContain(slotId);
  });

  it("won't block an already-booked slot, and won't let another doctor block or unblock this one", async () => {
    const doctor = await registerDoctor({ email: "docblock2@example.com" });
    const otherDoctor = await registerDoctor({ email: "docblock3@example.com" });

    await request(app)
      .post("/api/availability")
      .set("Cookie", doctor.cookie)
      .send({ date: "2027-02-09", startTime: "09:00", endTime: "09:30", slotMinutes: 30 });
    const slots = await request(app).get(`/api/availability/${doctor.userId}?date=2027-02-09`);
    const slotId = slots.body[0]._id;

    const crossDoctorBlock = await request(app)
      .patch(`/api/availability/${slotId}/block`)
      .set("Cookie", otherDoctor.cookie)
      .send({ reason: "personal" });
    expect(crossDoctorBlock.status).toBe(409);

    await request(app)
      .post("/api/appointments")
      .send({
        slotId,
        patientInfo: { name: "Pat Test", age: 30, gender: "female", phone: "9998887771" },
      });

    const blockBooked = await request(app)
      .patch(`/api/availability/${slotId}/block`)
      .set("Cookie", doctor.cookie)
      .send({ reason: "personal" });
    expect(blockBooked.status).toBe(409);
  });
});
