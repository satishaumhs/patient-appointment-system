const rateLimit = require("express-rate-limit");

// Shared shape: 20 requests / 15 min per IP. Used both for auth endpoints and
// the public, unauthenticated appointment endpoints (anonymous booking and
// reference-number lookup) -- those have no account behind them to add
// friction, so without this someone could script slot-squatting across every
// doctor's calendar, or brute-force reference-number lookups.
const makeLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again later" },
    // The limiter's hit counter is in-memory and lives for the process
    // lifetime, not per-test -- without this, tests share one counter (every
    // test file runs in the same `--runInBand` process) and start failing
    // once enough of them together exceed `max`, regardless of what any
    // individual test does. Doesn't affect real request handling.
    skip: () => process.env.NODE_ENV === "test",
  });

const authLimiter = makeLimiter();
const publicAppointmentLimiter = makeLimiter();

module.exports = { authLimiter, publicAppointmentLimiter };
