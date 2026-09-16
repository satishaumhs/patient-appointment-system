const { test, expect } = require("@playwright/test");
const { registerDoctor, createSlot, getSlots, bookAppointment, daysFromNow } = require("./helpers");

test("doctor logs in, accepts a pending request, and the patient sees it confirmed", async ({ page, request }) => {
  const doctor = await registerDoctor(request, { name: "Dr. Owen Reyes", specialization: "Pediatrician" });
  const targetDate = daysFromNow(4);
  await createSlot(request, { date: targetDate, startTime: "11:00", endTime: "11:30" });
  const slots = await getSlots(request, doctor.id, targetDate);

  // Booking itself is exercised end-to-end in patient-booking.spec.js --
  // here it's background setup for what this spec actually verifies: the
  // doctor's own accept action, and that it's visible from the patient side.
  const appointment = await bookAppointment(request, {
    slotId: slots[0]._id,
    appointmentType: "in-person",
    patientInfo: { name: "Casey Client", age: 8, gender: "male", phone: "9876500002" },
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(doctor.email);
  await page.getByLabel("Password").fill(doctor.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Casey Client")).toBeVisible();

  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).not.toBeVisible();

  // Same fix as patient-booking.spec.js -- confirm the doctor's action is
  // actually visible from the anonymous, unauthenticated side too, not just
  // reflected back on the doctor's own already-authenticated dashboard.
  await page.goto("/status");
  await page.getByLabel("Reference number").fill(appointment.referenceNumber);
  await page.getByLabel("Mobile number").fill("9876500002");
  await page.getByRole("button", { name: "Check status" }).click();

  await expect(page.locator("span.capitalize")).toHaveText("confirmed");
});

test("doctor rejects a pending request", async ({ page, request }) => {
  const doctor = await registerDoctor(request, { name: "Dr. Nina Alvarez" });
  const targetDate = daysFromNow(4);
  await createSlot(request, { date: targetDate, startTime: "13:00", endTime: "13:30" });
  const slots = await getSlots(request, doctor.id, targetDate);

  await bookAppointment(request, {
    slotId: slots[0]._id,
    appointmentType: "in-person",
    patientInfo: { name: "Riley Reject", age: 29, gender: "female", phone: "9876500003" },
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(doctor.email);
  await page.getByLabel("Password").fill(doctor.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("rejected", { exact: true })).toBeVisible();
});
