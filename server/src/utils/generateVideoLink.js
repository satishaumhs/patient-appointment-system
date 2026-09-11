// Real, joinable Jitsi Meet rooms -- no API key or provider account needed.
// The reference number keeps the room traceable to its appointment; the
// random suffix stops a stranger from guessing a room from the public
// MHS-XXXXX reference-number pattern alone (Jitsi's public rooms are
// open-by-URL, with no access control of their own).
const generateVideoLink = (referenceNumber) =>
  `https://meet.jit.si/${referenceNumber}-${Math.random().toString(36).slice(2, 8)}`;

module.exports = generateVideoLink;
