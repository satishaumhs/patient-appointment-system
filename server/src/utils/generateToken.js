const jwt = require("jsonwebtoken");

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    // Client and API are on different origins in production (e.g. separate
    // Render subdomains), so the cookie needs sameSite:"none", which in turn
    // requires secure:true. Locally (same-site http://localhost) "lax" is
    // fine and avoids the secure-cookie-over-http restriction.
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
};

module.exports = generateToken;
