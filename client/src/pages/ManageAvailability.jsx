import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import MonthCalendar from "../components/MonthCalendar";
import StatCard from "../components/StatCard";
import { CalendarIcon, CheckCircleIcon, ClockIcon, UsersIcon, LockIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const GRID_START_HOUR = 9;
const GRID_END_HOUR = 21;
const SLOT_MINUTES = 30;

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

const ManageAvailability = () => {
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [error, setError] = useState("");

  const [bulkForm, setBulkForm] = useState({ date: "", startTime: "09:00", endTime: "17:00", slotMinutes: 30 });
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const loadAll = async () => {
    const [slotsRes, apptRes] = await Promise.all([api.get("/availability/mine"), api.get("/appointments")]);
    setSlots(slotsRes.data);
    setAppointments(apptRes.data);
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
        if (existing.isBooked) return;
        await api.delete(`/availability/${existing._id}`);
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

  const handleBulkChange = (e) => setBulkForm({ ...bulkForm, [e.target.name]: e.target.value });

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkError("");
    setBulkMessage("");
    setBulkSubmitting(true);
    try {
      const res = await api.post("/availability", { ...bulkForm, slotMinutes: Number(bulkForm.slotMinutes) });
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
      booked: inWeek.filter((s) => s.isBooked).length,
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Time slots</h2>
              <p className="text-xs text-gray-500">
                {new Date(selectedDate).toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-gray-300" /> Not offered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500" /> Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300" /> Booked
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
                        const state = existing ? (existing.isBooked ? "booked" : "open") : isPast ? "past" : "empty";
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={state === "booked" || state === "past"}
                            onClick={() => toggleGridSlot(t)}
                            title={state === "past" ? "This time has already passed" : undefined}
                            className={`text-xs px-2 py-2 rounded-md flex items-center justify-center gap-1 ${
                              state === "booked"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : state === "past"
                                  ? "border border-gray-100 text-gray-300 cursor-not-allowed"
                                  : state === "open"
                                    ? "bg-teal-600 text-white hover:bg-teal-700"
                                    : "border border-gray-300 text-gray-700 hover:border-teal-600"
                            }`}
                          >
                            {formatDisplayTime(t)}
                            {state === "booked" && <LockIcon className="w-3 h-3" />}
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
          {bulkError && <p className="col-span-2 text-sm text-red-600">{bulkError}</p>}
          {bulkMessage && <p className="col-span-2 text-sm text-green-700">{bulkMessage}</p>}
          <button
            type="submit"
            disabled={bulkSubmitting}
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
