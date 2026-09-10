import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import MonthCalendar from "./MonthCalendar";

const toDateKey = (d) => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Reuses the doctor's own upcoming slots (already fetched elsewhere via the
// same endpoint on Manage Availability) rather than a new backend call.
const ReschedulePanel = ({ appointmentId, onCancel, onRescheduled }) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [newSlotId, setNewSlotId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/availability/mine")
      .then((res) => setSlots(res.data.filter((s) => !s.isBooked)))
      .finally(() => setLoading(false));
  }, []);

  const availableDates = useMemo(() => new Set(slots.map((s) => toDateKey(s.startTime))), [slots]);

  const groupedDaySlots = useMemo(() => {
    const daySlots = selectedDate ? slots.filter((s) => toDateKey(s.startTime) === selectedDate) : [];
    const groups = [
      { label: "Morning", items: [] },
      { label: "Afternoon", items: [] },
      { label: "Evening", items: [] },
    ];
    daySlots.forEach((slot) => {
      const hour = new Date(slot.startTime).getHours();
      if (hour < 12) groups[0].items.push(slot);
      else if (hour < 17) groups[1].items.push(slot);
      else groups[2].items.push(slot);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [slots, selectedDate]);

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);
    try {
      await api.patch(`/appointments/${appointmentId}/reschedule`, { newSlotId });
      onRescheduled();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Reschedule failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
      {loading ? (
        <p className="text-sm text-gray-500">Loading your open slots...</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={(key) => {
              setSelectedDate(key);
              setNewSlotId("");
            }}
            availableDates={availableDates}
          />
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              {selectedDate ? "Pick a new time" : "Choose a date with open slots"}
            </p>
            {selectedDate && groupedDaySlots.length === 0 && (
              <p className="text-sm text-gray-500">No open slots that day.</p>
            )}
            <div className="space-y-3">
              {groupedDaySlots.map((group) => (
                <div key={group.label}>
                  <p className="text-xs text-gray-400 mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((slot) => (
                      <button
                        key={slot._id}
                        type="button"
                        onClick={() => setNewSlotId(slot._id)}
                        className={`text-xs px-2 py-1.5 rounded-md border ${
                          newSlotId === slot._id
                            ? "bg-teal-600 text-white border-teal-600"
                            : "border-gray-300 text-gray-700 hover:border-teal-600 bg-white"
                        }`}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newSlotId || submitting}
                onClick={handleConfirm}
                className="text-xs px-3 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Rescheduling..." : "Confirm new time"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReschedulePanel;
