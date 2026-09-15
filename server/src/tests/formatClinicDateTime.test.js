const formatClinicDateTime = require("../utils/formatClinicDateTime");

describe("formatClinicDateTime", () => {
  it("always renders clinic-local (IST) time, regardless of the host process's own timezone", () => {
    // 03:30 UTC is 09:00 IST (UTC+5:30) -- this is the exact discrepancy
    // that shipped in Telegram/notification message text before this fix,
    // since Render's server runs in UTC while the clinic operates in IST.
    const date = new Date("2026-09-16T03:30:00.000Z");
    expect(formatClinicDateTime(date)).toBe("9/16/2026, 9:00:00 AM");
  });

  it("carries a date across the IST day boundary correctly", () => {
    // 19:00 UTC on the 15th is 00:30 IST on the 16th.
    const date = new Date("2026-09-15T19:00:00.000Z");
    expect(formatClinicDateTime(date)).toBe("9/16/2026, 12:30:00 AM");
  });
});
