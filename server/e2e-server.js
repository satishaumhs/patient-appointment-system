// Entry point for Playwright's webServer, not for real deployment. Playwright
// drives a real browser against a real running Express process -- unlike
// Jest+Supertest, which calls into the app in-process -- but it must never
// point that process at the shared dev/prod Atlas cluster in server/.env,
// since these tests do real atomic slot-claim writes. This spins up its own
// throwaway MongoMemoryServer (the same real-MongoDB-engine approach
// src/tests/setup.js already uses for Jest) and points the real server at
// that instead, before anything reads MONGO_URI.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-secret-key";

const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongoServer = await MongoMemoryServer.create();
  // dotenv's config() (called inside src/server.js) never overwrites an
  // already-set env var, so setting this first is what makes the override
  // stick instead of silently falling back to .env's real MONGO_URI.
  process.env.MONGO_URI = mongoServer.getUri();

  require("./src/server.js");
})();
