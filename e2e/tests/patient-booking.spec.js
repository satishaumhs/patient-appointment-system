const { test, expect } = require("@playwright/test");
const { registerDoctor, createSlot, getSlots, daysFromNow } = require("./helpers");

test("anonymous patient books an appointment and looks its status up later", async ({ page, request }) => {
  const doctor = await registerDoctor(request, { name: "Dr. Priya Sharma", specialization: "Cardiologist" });
  const targetDate = daysFromNow(5);
  await createSlot(request, { date: targetDate, startTime: "09:00", endTime: "09:30" });

  await page.goto("/");

  // No specialty filter needed -- the fixture created exactly one doctor,
  // so selecting straight from the full "Select a doctor" list is enough
  // and keeps this test decoupled from the specialty dropdown's own
  // behavior (that's FindDoctor.jsx's job, covered separately).
  await page.getByLabel("Select a doctor").selectOption(doctor.id);

  // Exactly one date has an opening, so BookAppointment.jsx auto-selects it
  // -- no date-chip click needed, just wait for that day's own time button.
  await page.getByRole("button", { name: "09:00 AM" }).click();

  await page.getByLabel("Full name").fill("Jordan Patient");
  await page.getByLabel("Mobile number").fill("9876500001");
  await page.getByLabel("Age").fill("34");
  await page.getByLabel("Gender").selectOption("female");

  await page.getByRole("button", { name: "Book Appointment" }).click();

  const referenceLocator = page.getByText(/^MHS-\d{5}$/);
  await expect(referenceLocator).toBeVisible();
  await expect(page.getByText("Status: Pending doctor confirmation")).toBeVisible();
  const referenceNumber = await referenceLocator.textContent();

  // The reference number is the only thing carried forward -- proving the
  // patient could walk away and come back later with just that plus their
  // phone number, exactly like the real product story.
  await page.getByRole("link", { name: "Check appointment status" }).click();
  await expect(page).toHaveURL(/\/status$/);

  await page.getByLabel("Reference number").fill(referenceNumber);
  await page.getByLabel("Mobile number").fill("9876500001");
  await page.getByRole("button", { name: "Check status" }).click();

  await expect(page.getByText("Jordan Patient")).toBeVisible();
  await expect(page.getByText("Dr. Priya Sharma")).toBeVisible();
  await expect(page.locator("span.capitalize")).toHaveText("pending");
});

test("looking up a real reference number with the wrong phone fails the same way as an unknown reference", async ({
  page,
  request,
}) => {
  const doctor = await registerDoctor(request, { specialization: "Dermatologist" });
  const targetDate = daysFromNow(6);
  await createSlot(request, { date: targetDate, startTime: "10:00", endTime: "10:30" });
  const slots = await getSlots(request, doctor.id, targetDate);

  const booking = await request.post("http://localhost:5000/api/appointments", {
    data: {
      slotId: slots[0]._id,
      appointmentType: "in-person",
      patientInfo: { name: "Wrong Phone Test", age: 40, gender: "male", phone: "9111111111" },
    },
  });
  const { referenceNumber } = await booking.json();

  await page.goto("/status");
  await page.getByLabel("Reference number").fill(referenceNumber);
  await page.getByLabel("Mobile number").fill("9000000000"); // wrong on purpose
  await page.getByRole("button", { name: "Check status" }).click();

  await expect(page.getByText("No appointment found for that reference number and phone number")).toBeVisible();
});
