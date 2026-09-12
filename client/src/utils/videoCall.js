// A video appointment's join link becomes usable a little before the booked
// slot starts and stops being offered once the slot's actual end time has
// passed -- not the whole time between doctor-confirmation and the visit,
// which could be days. Needs the real slot end time (populated by the
// backend as `slot.endTime`), not a guessed duration, since slot length
// varies per doctor/booking.
const JOIN_WINDOW_BEFORE_MS = 10 * 60 * 1000;

export const isVideoCallJoinable = (appointment) => {
  if (!appointment?.videoLink || !appointment?.slot?.endTime) return false;
  const now = Date.now();
  const opensAt = new Date(appointment.date).getTime() - JOIN_WINDOW_BEFORE_MS;
  const closesAt = new Date(appointment.slot.endTime).getTime();
  return now >= opensAt && now <= closesAt;
};

export const isVideoCallUpcoming = (appointment) => {
  if (!appointment?.videoLink || !appointment?.slot?.endTime) return false;
  const opensAt = new Date(appointment.date).getTime() - JOIN_WINDOW_BEFORE_MS;
  return Date.now() < opensAt;
};
