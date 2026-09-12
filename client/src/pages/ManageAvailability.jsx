import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import MonthCalendar from "../components/MonthCalendar";
import StatCard from "../components/StatCard";
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  LockIcon,
  BanIcon,
  BellIcon,
  ChevronLeftIcon,
} from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const GRID_START_HOUR = 9;
const GRID_END_HOUR = 21;
const SLOT_MINUTES = 30;

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const BLOCK_REASONS = [
  { value: "meeting", label: "Meeting" },
  { value: "break", label: "Break" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

const DAY_GRID_TIMES = (() => {
  const times = [];
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    times.push(`${String(h).padStart(2, "0")}:30`);
  }
  return times;
})();

const toDateKey = (d) => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addMinutes = (timeStr, minutes) => {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

const isPastTimeToday = (dateKey, timeStr) => {
  if (dateKey !== todayKey()) return false;
  const [h, m] = timeStr.split(":").map(Number);
  const slotMoment = new Date();
  slotMoment.setHours(h, m, 0, 0);
  return slotMoment < new Date();
};

const periodOf = (timeStr) => {
  const hour = Number(timeStr.split(":")[0]);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
};

const formatDisplayTime = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const todayKey = () => toDateKey(new Date());

const BLOCK_REASON_LABEL = Object.fromEntries(BLOCK_REASONS.map((r) => [r.value, r.label]));

const ManageAvailability = () => {
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [error, setError] = useState("");

  const [blockForm, setBlockForm] = useState({ slotId: "", reason: "meeting" });
  const [blockMessage, setBlockMessage] = useState("");
  const [blockError, setBlockError] = useState("");
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const [bulkForm, setBulkForm] = useState({
    date: "",
    startTime: "09:00",
    endTime: "17:00",
    slotMinutes: 30,
    repeatUntil: "",
  });
  const [repeatOn, setRepeatOn] = useState(new Set([1, 2, 3, 4, 5]));
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const loadAll = async () => {
    const [slotsRes, apptRes, waitlistRes] = await Promise.all([
      api.get("/availability/mine"),
      api.get("/appointments"),
      api.get("/waitlist/mine"),
    ]);
    setSlots(slotsRes.data);
    setAppointments(apptRes.data);
    setWaitlist(waitlistRes.data);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const findSlotAt = (dateKey, timeStr) =>
    slots.find((s) => {
      const start = new Date(s.startTime);
      return toDateKey(start) === dateKey && start.toTimeString().slice(0, 5) === timeStr;
    });

  const toggleGridSlot = async (timeStr) => {
    setError("");
    const existing = findSlotAt(selectedDate, timeStr);
    try {
      if (existing) {
        if (existing.blockedReason) {
          await api.patch(`/availability/${existing._id}/unblock`);
        } else if (existing.isBooked) {
          return;
        } else {
          await api.delete(`/availability/${existing._id}`);
        }
      } else {
        await api.post("/availability", {
          date: selectedDate,
          startTime: timeStr,
          endTime: addMinutes(timeStr, SLOT_MINUTES),
          slotMinutes: SLOT_MINUTES,
        });
      }
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update slot");
    }
  };

  const openSlotsForSelectedDate = useMemo(
    () => slots.filter((s) => toDateKey(s.startTime) === selectedDate && !s.isBooked && !s.blockedReason),
    [slots, selectedDate]
  );

  const [clearingDay, setClearingDay] = useState(false);

  const handleClearDay = async () => {
    if (openSlotsForSelectedDate.length === 0) return;
    const dayLabel = new Date(selectedDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    if (
      !window.confirm(
        `Remove all ${openSlotsForSelectedDate.length} open slot(s) on ${dayLabel}? Booked and blocked slots are left as-is.`
      )
    ) {
      return;
    }
    setError("");
    setClearingDay(true);
    try {
      for (const slot of openSlotsForSelectedDate) {
        await api.delete(`/availability/${slot._id}`);
      }
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to clear the day");
    } finally {
      setClearingDay(false);
    }
  };

  const handleBlockChange = (e) => setBlockForm({ ...blockForm, [e.target.name]: e.target.value });

  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    setBlockError("");
    setBlockMessage("");
    setBlockSubmitting(true);
    try {
      await api.patch(`/availability/${blockForm.slotId}/block`, { reason: blockForm.reason });
      setBlockMessage("Slot blocked.");
      setBlockForm({ ...blockForm, slotId: "" });
      loadAll();
    } catch (err) {
      setBlockError(err.response?.data?.message || "Failed to block that slot");
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleBulkChange = (e) => setBulkForm({ ...bulkForm, [e.target.name]: e.target.value });

  const toggleRepeatDay = (value) => {
    setRepeatOn((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkError("");
    setBulkMessage("");
    setBulkSubmitting(true);
    try {
      const payload = {
        date: bulkForm.date,
        startTime: bulkForm.startTime,
        endTime: bulkForm.endTime,
        slotMinutes: Number(bulkForm.slotMinutes),
      };
      if (bulkForm.repeatUntil) {
        payload.repeatUntil = bulkForm.repeatUntil;
        payload.repeatOn = [...repeatOn];
      }
      const res = await api.post("/availability", payload);
      setBulkMessage(res.data.message);
      loadAll();
    } catch (err) {
      setBulkError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Failed to create slots");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openDates = useMemo(() => new Set(slots.filter((s) => !s.isBooked).map((s) => toDateKey(s.startTime))), [
    slots,
  ]);

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return [...Array(7)].map((_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const key = toDateKey(date);
      return { key, date, count: slots.filter((s) => toDateKey(s.startTime) === key).length };
    });
  }, [slots]);

  const weekStats = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = slots.filter((s) => {
      const d = new Date(s.startTime);
      return d >= start && d < end;
    });
    return {
      total: inWeek.length,
      booked: inWeek.filter((s) => s.isBooked && !s.blockedReason).length,
      open: inWeek.filter((s) => !s.isBooked).length,
    };
  }, [slots]);

  const patientsToday = useMemo(() => {
    const key = todayKey();
    const phones = appointments.filter((a) => toDateKey(a.date) === key).map((a) => a.patientInfo?.phone);
    return new Set(phones.filter(Boolean)).size;
  }, [appointments]);

  const isPastSelectedDate = new Date(selectedDate) < new Date(todayKey());

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Manage availability</h1>
      <p className="text-sm text-gray-500 mb-6">
        Set your available time slots. Patients can only book times you've opened up.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CalendarIcon} label="Slots this week" value={weekStats.total} tint="blue" />
        <StatCard icon={CheckCircleIcon} label="Booked this week" value={weekStats.booked} tint="teal" />
        <StatCard icon={ClockIcon} label="Open this week" value={weekStats.open} tint="amber" />
        <StatCard icon={UsersIcon} label="Patients today" value={patientsToday} tint="purple" />
      </div>

      {waitlist.length > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-violet-900">
            <BellIcon className="w-4 h-4 text-violet-600" />
            <b>{waitlist.length}</b> {waitlist.length === 1 ? "patient is" : "patients are"} waiting for you to open
            more slots
          </div>
          <div className="flex flex-wrap gap-1.5">
            {waitlist.slice(0, 5).map((w) => (
              <span key={w._id} className="text-xs bg-white text-violet-700 border border-violet-200 rounded-full px-2.5 py-1">
                {w.name}
              </span>
            ))}
            {waitlist.length > 5 && (
              <span className="text-xs text-violet-600 px-1 py-1">+{waitlist.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <MonthCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} availableDates={openDates} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Next 7 days</h3>
            <div className="space-y-1">
              {weekDays.map(({ key, date, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm ${
                    selectedDate === key ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="text-xs text-gray-400">
                    {count} slot{count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Time slots</h2>
              <p className="text-xs text-gray-500">
                {new Date(selectedDate).toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {openSlotsForSelectedDate.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearDay}
                  disabled={clearingDay}
                  className="text-xs font-medium text-red-600 hover:underline mt-1 disabled:opacity-50"
                >
                  {clearingDay
                    ? "Clearing..."
                    : `Clear this day (${openSlotsForSelectedDate.length} open slot${openSlotsForSelectedDate.length === 1 ? "" : "s"})`}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-gray-300" /> Not offered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500" /> Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300" /> Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" /> Blocked
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {isPastSelectedDate ? (
            <p className="text-sm text-gray-500">Can't edit availability for a past date.</p>
          ) : (
            <div className="space-y-4">
              {["Morning", "Afternoon", "Evening"].map((period) => {
                const times = DAY_GRID_TIMES.filter((t) => periodOf(t) === period);
                return (
                  <div key={period}>
                    <p className="text-xs font-medium text-gray-500 mb-2">{period}</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {times.map((t) => {
                        const existing = findSlotAt(selectedDate, t);
                        const isPast = isPastTimeToday(selectedDate, t);
                        const state = existing
                          ? existing.blockedReason
                            ? "blocked"
                            : existing.isBooked
                              ? "booked"
                              : "open"
                          : isPast
                            ? "past"
                            : "empty";
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={state === "booked" || state === "past"}
                            onClick={() => toggleGridSlot(t)}
                            title={
                              state === "past"
                                ? "This time has already passed"
                                : state === "blocked"
                                  ? `Blocked: ${BLOCK_REASON_LABEL[existing.blockedReason]} (click to unblock)`
                                  : undefined
                            }
                            className={`text-xs px-2 py-2 rounded-md flex items-center justify-center gap-1 ${
                              state === "booked"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : state === "blocked"
                                  ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                  : state === "past"
                                    ? "border border-gray-100 text-gray-300 cursor-not-allowed"
                                    : state === "open"
                                      ? "bg-teal-600 text-white hover:bg-teal-700"
                                      : "border border-gray-300 text-gray-700 hover:border-teal-600"
                            }`}
                          >
                            {formatDisplayTime(t)}
                            {state === "booked" && <LockIcon className="w-3 h-3" />}
                            {state === "blocked" && <BanIcon className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <details className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <summary className="text-sm font-semibold text-gray-900 cursor-pointer">
          Block a time slot
        </summary>
        <form onSubmit={handleBlockSubmit} className="grid grid-cols-2 gap-4 mt-4 max-w-lg">
          <p className="col-span-2 text-xs text-gray-500 -mt-1">
            Blocking an open time on{" "}
            {new Date(selectedDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} —
            pick a different date above to block a slot on another day.
          </p>
          <div className="col-span-2">
            <label htmlFor="blockSlotId" className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <select
              id="blockSlotId"
              name="slotId"
              value={blockForm.slotId}
              onChange={handleBlockChange}
              required
              className={inputClass}
            >
              <option value="" disabled>
                {openSlotsForSelectedDate.length === 0 ? "No open times on this date" : "Select an open time"}
              </option>
              {openSlotsForSelectedDate.map((s) => (
                <option key={s._id} value={s._id}>
                  {formatDisplayTime(new Date(s.startTime).toTimeString().slice(0, 5))}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="blockReasonSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <select
              id="blockReasonSelect"
              name="reason"
              value={blockForm.reason}
              onChange={handleBlockChange}
              className={inputClass}
            >
              {BLOCK_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {blockError && <p className="col-span-2 text-sm text-red-600">{blockError}</p>}
          {blockMessage && <p className="col-span-2 text-sm text-green-700">{blockMessage}</p>}
          <button
            type="submit"
            disabled={blockSubmitting || !blockForm.slotId}
            className="col-span-2 rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {blockSubmitting ? "Blocking..." : "Block slot"}
          </button>
        </form>
      </details>

      <details className="bg-white rounded-xl border border-gray-200 p-5">
        <summary className="text-sm font-semibold text-gray-900 cursor-pointer">
          Generate a range of slots at once
        </summary>
        <form onSubmit={handleBulkSubmit} className="grid grid-cols-2 gap-4 mt-4 max-w-lg">
          <div className="col-span-2">
            <label htmlFor="bulkDate" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              id="bulkDate"
              type="date"
              name="date"
              value={bulkForm.date}
              onChange={handleBulkChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bulkStartTime" className="block text-sm font-medium text-gray-700 mb-1">
              Start time
            </label>
            <input
              id="bulkStartTime"
              type="time"
              name="startTime"
              value={bulkForm.startTime}
              onChange={handleBulkChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bulkEndTime" className="block text-sm font-medium text-gray-700 mb-1">
              End time
            </label>
            <input
              id="bulkEndTime"
              type="time"
              name="endTime"
              value={bulkForm.endTime}
              onChange={handleBulkChange}
              required
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="bulkSlotMinutes" className="block text-sm font-medium text-gray-700 mb-1">
              Slot length (minutes)
            </label>
            <select
              id="bulkSlotMinutes"
              name="slotMinutes"
              value={bulkForm.slotMinutes}
              onChange={handleBulkChange}
              className={inputClass}
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
              <option value={60}>60</option>
            </select>
          </div>

          <div className="col-span-2 pt-2 border-t border-gray-100">
            <label htmlFor="bulkRepeatUntil" className="block text-sm font-medium text-gray-700 mb-1">
              Repeat until (optional)
            </label>
            <input
              id="bulkRepeatUntil"
              type="date"
              name="repeatUntil"
              value={bulkForm.repeatUntil}
              onChange={handleBulkChange}
              min={bulkForm.date}
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to generate slots for just the one date above.
            </p>
          </div>

          {bulkForm.repeatUntil && (
            <div className="col-span-2">
              <p className="block text-sm font-medium text-gray-700 mb-1.5">Repeat on</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleRepeatDay(day.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                      repeatOn.has(day.value)
                        ? "bg-teal-600 text-white border-teal-600"
                        : "border-gray-300 text-gray-600 hover:border-teal-600"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bulkError && <p className="col-span-2 text-sm text-red-600">{bulkError}</p>}
          {bulkMessage && <p className="col-span-2 text-sm text-green-700">{bulkMessage}</p>}
          <button
            type="submit"
            disabled={bulkSubmitting || (bulkForm.repeatUntil && repeatOn.size === 0)}
            className="col-span-2 rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {bulkSubmitting ? "Generating..." : "Generate slots"}
          </button>
        </form>
      </details>
    </div>
  );
};

export default ManageAvailability;
