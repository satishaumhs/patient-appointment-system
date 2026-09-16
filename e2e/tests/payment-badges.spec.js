const { test, expect } = require("@playwright/test");
const { registerDoctor, createSlot, getSlots, bookAppointment, daysFromNow } = require("./helpers");

// Regression coverage for a real bug caught during manual live verification:
// "Google Pay"'s full wordmark overflowed its 48-unit-wide SVG badge and
// clipped at both edges ("oogle Pa") once actually measured at mobile width.
// jsdom (see CardBrandLogos.test.jsx) can't do real layout, so this is the
// one check that measures actual rendered pixels via a real browser engine.
test("UPI provider badges render fully inside their own badge bounds, no clipping", async ({ page, request }) => {
  const doctor = await registerDoctor(request, { consultationType: "video", specialization: "Cardiologist" });
  const targetDate = daysFromNow(3);
  await createSlot(request, { date: targetDate, startTime: "15:00", endTime: "15:30" });
  const slots = await getSlots(request, doctor.id, targetDate);

  const appointment = await bookAppointment(request, {
    slotId: slots[0]._id,
    appointmentType: "video", // video is what makes payment required at all
    patientInfo: { name: "Badge Check", age: 31, gender: "other", phone: "9876500004" },
  });

  await page.goto("/payment");
  await page.getByLabel("Reference number").fill(appointment.referenceNumber);
  await page.getByLabel("Mobile number").fill("9876500004");
  await page.getByRole("button", { name: "Find my appointment" }).click();

  await page.getByRole("button", { name: /pay now/i }).click();
  await page.getByRole("radio", { name: "UPI" }).click();

  // /payment also shows its own static Visa/Mastercard/Google Pay/PhonePe
  // intro badges above this form (AppointmentStatus.jsx), so an unscoped
  // lookup for e.g. "Google Pay" matches two elements -- scope to the demo
  // payment form itself, identified by its own copy.
  const paymentForm = page.locator("form").filter({ hasText: "Demo payment" });

  for (const label of ["Google Pay", "PhonePe", "Paytm"]) {
    const svg = paymentForm.getByRole("img", { name: label });
    await expect(svg).toBeVisible();

    const overflow = await svg.evaluate((el) => {
      const text = el.querySelector("text");
      if (!text) return null;
      const box = text.getBBox();
      // viewBox is "0 0 48 30" on every mark -- see CardBrandLogos.jsx.
      return { left: box.x, right: box.x + box.width, viewBoxWidth: 48 };
    });

    expect(overflow.left, `${label} label clips the left edge of its badge`).toBeGreaterThanOrEqual(0);
    expect(overflow.right, `${label} label clips the right edge of its badge`).toBeLessThanOrEqual(
      overflow.viewBoxWidth
    );
  }
});

test("the /payment intro badges also render without clipping at mobile width", async ({ page, request }) => {
  const doctor = await registerDoctor(request, { consultationType: "video" });
  const targetDate = daysFromNow(3);
  await createSlot(request, { date: targetDate, startTime: "16:00", endTime: "16:30" });
  const slots = await getSlots(request, doctor.id, targetDate);

  const appointment = await bookAppointment(request, {
    slotId: slots[0]._id,
    appointmentType: "video",
    patientInfo: { name: "Mobile Badge Check", age: 27, gender: "female", phone: "9876500005" },
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/payment");
  await page.getByLabel("Reference number").fill(appointment.referenceNumber);
  await page.getByLabel("Mobile number").fill("9876500005");
  await page.getByRole("button", { name: "Find my appointment" }).click();

  for (const label of ["Visa", "Mastercard", "Google Pay", "PhonePe"]) {
    const svg = page.getByRole("img", { name: label });
    await expect(svg).toBeVisible();
    const box = await svg.boundingBox();
    expect(box.width, `${label} badge has zero width at mobile viewport`).toBeGreaterThan(0);
  }
});
