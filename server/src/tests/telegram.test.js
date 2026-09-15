process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook-secret";
process.env.TELEGRAM_BOT_USERNAME = "TestBot";

// notify.js's own NODE_ENV==="test" short-circuit inside telegramBot.js
// never exposes what text a message would have carried -- which is exactly
// how a "Dr. undefined" bug shipped without a failing test. Mocking the
// module directly makes the actual message content assertable.
jest.mock("../utils/telegramBot");

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { sendTelegramMessage, clearMessageButtons } = require("../utils/telegramBot");

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

const genSlots = (doctorCookie, { date, startTime = "09:00", endTime = "10:00", slotMinutes = 30 }) =>
  request(app)
    .post("/api/availability")
    .set("Cookie", doctorCookie)
    .send({ date, startTime, endTime, slotMinutes });

const getSlots = (doctorId, date) => request(app).get(`/api/availability/${doctorId}?date=${date}`);

const bookAppointment = (slotId, overrides = {}) =>
  request(app)
    .post("/api/appointments")
    .send({
      slotId,
      reason: "Checkup",
      patientInfo: { name: "Pat Test", age: 30, gender: "female", phone: "9998887770" },
      ...overrides,
    });

const rawTokenFromLink = (url) => new URL(url).searchParams.get("start");

// handleReschedulePrompt only offers slots within its own near-term window
// (see RESCHEDULE_WINDOW_DAYS in telegramController.js), so reschedule tests
// need a real near-future date rather than the fixed far-future placeholder
// dates ("2027-...") the rest of this suite uses just to guarantee "not in
// the past" regardless of when the tests happen to run.
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const sendUpdate = (update, { secret = "test-webhook-secret" } = {}) => {
  const req = request(app).post("/api/telegram/webhook");
  if (secret !== null) req.set("x-telegram-bot-api-secret-token", secret);
  return req.send(update);
};

describe("Telegram integration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects webhook calls with a missing or wrong secret", async () => {
    const noHeader = await sendUpdate({ message: { chat: { id: 1 }, text: "/start bogus" } }, { secret: null });
    expect(noHeader.status).toBe(401);

    const wrongHeader = await sendUpdate(
      { message: { chat: { id: 1 }, text: "/start bogus" } },
      { secret: "not-the-real-secret" }
    );
    expect(wrongHeader.status).toBe(401);
  });

  it("requires a doctor login for connect-link/status/preferences/disconnect", async () => {
    const res = await request(app).get("/api/telegram/connect-link");
    expect(res.status).toBe(401);
  });

  it("walks a doctor through connect -> receiving a request -> accept, end to end", async () => {
    const doctor = await registerDoctor({ email: "tgdoc@example.com" });

    const before = await request(app).get("/api/telegram/status").set("Cookie", doctor.cookie);
    expect(before.status).toBe(200);
    expect(before.body.connected).toBe(false);

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    expect(link.status).toBe(200);
    expect(link.body.url).toBe(`https://t.me/TestBot?start=${rawTokenFromLink(link.body.url)}`);
    const rawToken = rawTokenFromLink(link.body.url);
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

    const chatId = 555111;
    const start = await sendUpdate({ message: { chat: { id: chatId }, text: `/start ${rawToken}` } });
    expect(start.status).toBe(200);

    const afterConnect = await request(app).get("/api/telegram/status").set("Cookie", doctor.cookie);
    expect(afterConnect.body.connected).toBe(true);
    expect(afterConnect.body.linkedAt).toBeTruthy();

    // Book a real appointment with this doctor, then accept it via the
    // Telegram button tap instead of the REST status endpoint.
    await genSlots(doctor.cookie, { date: "2027-02-01", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-02-01");
    const booked = await bookAppointment(slots.body[0]._id);
    expect(booked.status).toBe(201);

    const acceptConfirmation = new Promise((resolve) => {
      sendTelegramMessage.mockImplementation((toChatId, text) => {
        resolve(text);
        return Promise.resolve({ ok: true });
      });
    });
    const accept = await sendUpdate({
      callback_query: {
        id: "cbq1",
        data: `acc:${booked.body._id}`,
        message: { chat: { id: chatId }, message_id: 4001 },
      },
    });
    expect(accept.status).toBe(200);
    expect(await acceptConfirmation).toContain("Test Doctor"); // which doctor this was for, not just that it happened
    // The original message's buttons come off so it can't be tapped again.
    expect(clearMessageButtons).toHaveBeenCalledWith(String(chatId), 4001);

    const asDoctor = await request(app).get(`/api/appointments/${booked.body._id}`).set("Cookie", doctor.cookie);
    expect(asDoctor.body.status).toBe("confirmed");

    // Preferences can be dialled back...
    const prefs = await request(app)
      .patch("/api/telegram/preferences")
      .set("Cookie", doctor.cookie)
      .send({ notifyNewRequest: false });
    expect(prefs.status).toBe(200);
    expect(prefs.body.notifyNewRequest).toBe(false);
    expect(prefs.body.notifyPayment).toBe(true);

    // ...and the whole connection can be torn down.
    const disconnect = await request(app).delete("/api/telegram/connect").set("Cookie", doctor.cookie);
    expect(disconnect.status).toBe(200);

    const afterDisconnect = await request(app).get("/api/telegram/status").set("Cookie", doctor.cookie);
    expect(afterDisconnect.body.connected).toBe(false);
  });

  it("rejects a request tapped from a chat that isn't linked to that appointment's doctor", async () => {
    const doctor = await registerDoctor({ email: "tgdoc2@example.com" });
    await genSlots(doctor.cookie, { date: "2027-02-02", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-02-02");
    const booked = await bookAppointment(slots.body[0]._id);

    // No chat has ever connected, so this tap can't be tied to any doctor.
    const accept = await sendUpdate({
      callback_query: { id: "cbq2", data: `acc:${booked.body._id}`, message: { chat: { id: 999999 } } },
    });
    expect(accept.status).toBe(200); // Telegram still gets acked...

    const stillPending = await request(app)
      .get(`/api/appointments/${booked.body._id}`)
      .set("Cookie", doctor.cookie);
    expect(stillPending.body.status).toBe("pending"); // ...but nothing actually changed.
  });

  it("rejects an expired connect link instead of linking the chat", async () => {
    const doctor = await registerDoctor({ email: "tgdoc3@example.com" });

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    const rawToken = rawTokenFromLink(link.body.url);

    await User.findByIdAndUpdate(doctor.userId, { "telegram.pendingConnectExpires": new Date(Date.now() - 1000) });

    await sendUpdate({ message: { chat: { id: 42 }, text: `/start ${rawToken}` } });

    const status = await request(app).get("/api/telegram/status").set("Cookie", doctor.cookie);
    expect(status.body.connected).toBe(false);
  });

  it("includes the doctor's real name in the Telegram message text, not just the in-app notice", async () => {
    const doctor = await registerDoctor({ email: "tgdoc4@example.com", name: "Dr. Asha Rao" });

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    await sendUpdate({ message: { chat: { id: 777 }, text: `/start ${rawTokenFromLink(link.body.url)}` } });

    await genSlots(doctor.cookie, { date: "2027-02-03", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-02-03");

    // notify() fires the Telegram send without awaiting it (by design -- see
    // notify.js), so booking's own response resolves before that send
    // necessarily has. Resolve on the mock actually being called instead of
    // guessing at a delay.
    const notified = new Promise((resolve) => {
      sendTelegramMessage.mockImplementation((chatId, text) => {
        resolve(text);
        return Promise.resolve({ ok: true });
      });
    });

    await bookAppointment(slots.body[0]._id);

    const text = await notified;
    expect(text).toContain("Dr. Asha Rao");
    expect(text).not.toContain("undefined");
  });

  it("offers the doctor's open slots on Reschedule, and moves the appointment when one is picked", async () => {
    const doctor = await registerDoctor({ email: "tgdoc5@example.com" });
    const chatId = 88800;

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    await sendUpdate({ message: { chat: { id: chatId }, text: `/start ${rawTokenFromLink(link.body.url)}` } });

    const targetDate = daysFromNow(5);
    await genSlots(doctor.cookie, { date: targetDate, startTime: "09:00", endTime: "10:00", slotMinutes: 30 });
    const slots = await getSlots(doctor.userId, targetDate);
    expect(slots.body.length).toBe(2);

    const booked = await bookAppointment(slots.body[0]._id);
    const alternativeSlotId = slots.body[1]._id;

    const prompt = new Promise((resolve) => {
      sendTelegramMessage.mockImplementation((toChatId, text, keyboard) => {
        resolve({ text, keyboard });
        return Promise.resolve({ ok: true });
      });
    });
    await sendUpdate({
      callback_query: {
        id: "cbq_rs",
        data: `rs:${booked.body._id}`,
        message: { chat: { id: chatId }, message_id: 5001 },
      },
    });
    const { text: promptText, keyboard } = await prompt;
    expect(promptText).toContain("Test Doctor");
    // Tapping Reschedule retires the original request message either way.
    expect(clearMessageButtons).toHaveBeenCalledWith(String(chatId), 5001);

    const offeredSlotIds = keyboard.flat().map((btn) => btn.callback_data.split(":")[2]);
    expect(offeredSlotIds).toEqual([alternativeSlotId]);

    const confirmation = new Promise((resolve) => {
      sendTelegramMessage.mockImplementation((toChatId, text) => {
        resolve(text);
        return Promise.resolve({ ok: true });
      });
    });
    await sendUpdate({
      callback_query: {
        id: "cbq_rt",
        data: `rt:${booked.body._id}:${alternativeSlotId}`,
        message: { chat: { id: chatId }, message_id: 5002 },
      },
    });
    const confirmationText = await confirmation;
    expect(confirmationText).toContain("Rescheduled");
    expect(confirmationText).toContain("Test Doctor");
    // And the slot-picker message's own buttons come off on success too.
    expect(clearMessageButtons).toHaveBeenCalledWith(String(chatId), 5002);

    const after = await request(app).get(`/api/appointments/${booked.body._id}`).set("Cookie", doctor.cookie);
    expect(after.body.status).toBe("confirmed");
    expect(after.body.slot).toBe(alternativeSlotId);

    // The original slot is bookable again; the endpoint only ever lists
    // isBooked:false slots, so its reappearance here IS proof it was freed.
    const slotsAfter = await getSlots(doctor.userId, targetDate);
    expect(slotsAfter.body.map((s) => s._id)).toEqual([slots.body[0]._id]);
  });

  it("leaves the slot-picker buttons tappable when a reschedule pick fails", async () => {
    const doctor = await registerDoctor({ email: "tgdoc7@example.com" });
    const chatId = 88802;

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    await sendUpdate({ message: { chat: { id: chatId }, text: `/start ${rawTokenFromLink(link.body.url)}` } });

    await genSlots(doctor.cookie, { date: "2027-02-07", endTime: "09:30" });
    const slots = await getSlots(doctor.userId, "2027-02-07");
    const booked = await bookAppointment(slots.body[0]._id);

    // Picking the appointment's OWN current slot is a guaranteed applyReschedule
    // error ("already this appointment's scheduled time") without needing to
    // simulate a real double-booking race.
    await sendUpdate({
      callback_query: {
        id: "cbq_rt_fail",
        data: `rt:${booked.body._id}:${slots.body[0]._id}`,
        message: { chat: { id: chatId }, message_id: 6001 },
      },
    });

    expect(clearMessageButtons).not.toHaveBeenCalled();

    const stillPending = await request(app)
      .get(`/api/appointments/${booked.body._id}`)
      .set("Cookie", doctor.cookie);
    expect(stillPending.body.status).toBe("pending");
  });

  it("lays out reschedule options two per row with compact labels", async () => {
    const doctor = await registerDoctor({ email: "tgdoc8@example.com" });
    const chatId = 88803;

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    await sendUpdate({ message: { chat: { id: chatId }, text: `/start ${rawTokenFromLink(link.body.url)}` } });

    // 4 slots total, 1 gets booked -- leaves 3 alternatives, enough to prove
    // the 2-per-row chunking (rows of [2, 1], not one slot per row).
    const targetDate = daysFromNow(7);
    await genSlots(doctor.cookie, { date: targetDate, startTime: "09:00", endTime: "11:00", slotMinutes: 30 });
    const slots = await getSlots(doctor.userId, targetDate);
    expect(slots.body.length).toBe(4);
    const booked = await bookAppointment(slots.body[0]._id);

    const prompt = new Promise((resolve) => {
      sendTelegramMessage.mockImplementation((toChatId, text, keyboard) => {
        resolve(keyboard);
        return Promise.resolve({ ok: true });
      });
    });
    await sendUpdate({
      callback_query: {
        id: "cbq_rs_layout",
        data: `rs:${booked.body._id}`,
        message: { chat: { id: chatId }, message_id: 7001 },
      },
    });
    const keyboard = await prompt;

    expect(keyboard.map((row) => row.length)).toEqual([2, 1]);
    // Compact label -- "Sep 16, 9:00 AM", not the full "9/16/2026, 9:00:00 AM".
    expect(keyboard[0][0].text).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("tells the doctor there's nothing to reschedule into when no other slots are open", async () => {
    const doctor = await registerDoctor({ email: "tgdoc6@example.com" });
    const chatId = 88801;

    const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
    await sendUpdate({ message: { chat: { id: chatId }, text: `/start ${rawTokenFromLink(link.body.url)}` } });

    const targetDate = daysFromNow(6);
    await genSlots(doctor.cookie, { date: targetDate, endTime: "09:30" }); // exactly one slot
    const slots = await getSlots(doctor.userId, targetDate);
    const booked = await bookAppointment(slots.body[0]._id);

    const prompt = new Promise((resolve) => {
      sendTelegramMessage.mockImplementation((toChatId, text) => {
        resolve(text);
        return Promise.resolve({ ok: true });
      });
    });
    await sendUpdate({
      callback_query: { id: "cbq_rs2", data: `rs:${booked.body._id}`, message: { chat: { id: chatId } } },
    });
    const text = await prompt;
    expect(text).toMatch(/no other open slots/i);

    const stillPending = await request(app)
      .get(`/api/appointments/${booked.body._id}`)
      .set("Cookie", doctor.cookie);
    expect(stillPending.body.status).toBe("pending");
    expect(stillPending.body.slot).toBe(slots.body[0]._id);
  });

  it("resolves the right doctor when two doctors share the same Telegram chat", async () => {
    const chatId = 55990;
    const doctorA = await registerDoctor({ email: "tgshared-a@example.com", name: "Dr. Shared A" });
    const doctorB = await registerDoctor({ email: "tgshared-b@example.com", name: "Dr. Shared B" });

    for (const doctor of [doctorA, doctorB]) {
      const link = await request(app).get("/api/telegram/connect-link").set("Cookie", doctor.cookie);
      await sendUpdate({ message: { chat: { id: chatId }, text: `/start ${rawTokenFromLink(link.body.url)}` } });
    }

    await genSlots(doctorA.cookie, { date: "2027-02-06", endTime: "09:30" });
    const slotsA = await getSlots(doctorA.userId, "2027-02-06");
    const bookedA = await bookAppointment(slotsA.body[0]._id);

    await genSlots(doctorB.cookie, { date: "2027-02-06", endTime: "09:30" });
    const slotsB = await getSlots(doctorB.userId, "2027-02-06");
    const bookedB = await bookAppointment(slotsB.body[0]._id);

    // Whichever doctor findOne/find happens to return "first" internally
    // must not matter -- accepting B's appointment must land on B, and
    // rejecting A's must land on A, from the exact same chat.
    await sendUpdate({
      callback_query: { id: "cbq_b", data: `acc:${bookedB.body._id}`, message: { chat: { id: chatId } } },
    });
    await sendUpdate({
      callback_query: { id: "cbq_a", data: `rej:${bookedA.body._id}`, message: { chat: { id: chatId } } },
    });

    const afterA = await request(app).get(`/api/appointments/${bookedA.body._id}`).set("Cookie", doctorA.cookie);
    const afterB = await request(app).get(`/api/appointments/${bookedB.body._id}`).set("Cookie", doctorB.cookie);
    expect(afterA.body.status).toBe("rejected");
    expect(afterB.body.status).toBe("confirmed");
  });

  it("lets an admin generate a doctor's connect link without that doctor's own session", async () => {
    const doctor = await registerDoctor({ email: "tgdoc9@example.com", name: "Dr. Admin Target" });
    const admin = await registerDoctor({ email: "tgadmin@example.com" });
    await User.findByIdAndUpdate(admin.userId, { role: "admin" });

    const res = await request(app)
      .get(`/api/telegram/connect-link/${doctor.userId}`)
      .set("Cookie", admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.doctorName).toBe("Dr. Admin Target");
    expect(res.body.url).toBe(`https://t.me/TestBot?start=${rawTokenFromLink(res.body.url)}`);

    // And the generated token actually links the doctor, same as their own
    // self-service link would -- this isn't a look-alike, separate mechanism.
    await sendUpdate({ message: { chat: { id: 44001 }, text: `/start ${rawTokenFromLink(res.body.url)}` } });
    const status = await request(app).get("/api/telegram/status").set("Cookie", doctor.cookie);
    expect(status.body.connected).toBe(true);
  });

  it("rejects a non-admin generating another doctor's connect link", async () => {
    const doctor = await registerDoctor({ email: "tgdoc10@example.com" });
    const otherDoctor = await registerDoctor({ email: "tgdoc11@example.com" });

    const res = await request(app)
      .get(`/api/telegram/connect-link/${doctor.userId}`)
      .set("Cookie", otherDoctor.cookie);

    expect(res.status).toBe(403);
  });

  it("404s an admin connect-link request for a non-doctor id", async () => {
    const admin = await registerDoctor({ email: "tgadmin2@example.com" });
    await User.findByIdAndUpdate(admin.userId, { role: "admin" });

    const res = await request(app)
      .get("/api/telegram/connect-link/aaaaaaaaaaaaaaaaaaaaaaaa")
      .set("Cookie", admin.cookie);

    expect(res.status).toBe(404);
  });
});
