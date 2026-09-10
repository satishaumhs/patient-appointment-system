import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { XIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900";

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ManageAvailability = () => {
  const [form, setForm] = useState({ date: "", startTime: "09:00", endTime: "17:00", slotMinutes: 30 });
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSlots = async () => {
    const res = await api.get("/availability/mine");
    setSlots(res.data);
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const res = await api.post("/availability", {
        ...form,
        slotMinutes: Number(form.slotMinutes),
      });
      setMessage(res.data.message);
      loadSlots();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          "Failed to create slots"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const removeSlot = async (id) => {
    setError("");
    try {
      await api.delete(`/availability/${id}`);
      loadSlots();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove slot");
    }
  };

  const groupedSlots = useMemo(() => {
    const groups = [];
    const byDate = {};
    slots.forEach((slot) => {
      const dateKey = new Date(slot.startTime).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
        groups.push(dateKey);
      }
      byDate[dateKey].push(slot);
    });
    return groups.map((dateKey) => ({ dateKey, daySlots: byDate[dateKey] }));
  }, [slots]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Manage availability</h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-4 mb-8 border border-gray-200 rounded-lg p-4"
      >
        <div className="col-span-2">
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            id="date"
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
          <input
            id="startTime"
            type="time"
            name="startTime"
            value={form.startTime}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">End time</label>
          <input
            id="endTime"
            type="time"
            name="endTime"
            value={form.endTime}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="slotMinutes" className="block text-sm font-medium text-gray-700 mb-1">Slot length (minutes)</label>
          <select id="slotMinutes" name="slotMinutes" value={form.slotMinutes} onChange={handleChange} className={inputClass}>
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={45}>45</option>
            <option value={60}>60</option>
          </select>
        </div>
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        {message && <p className="col-span-2 text-sm text-green-700">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="col-span-2 rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Generating..." : "Generate slots"}
        </button>
      </form>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Upcoming slots</h2>
      {slots.length === 0 ? (
        <p className="text-gray-500">No upcoming slots yet.</p>
      ) : (
        <div className="space-y-4">
          {groupedSlots.map(({ dateKey, daySlots }) => (
            <div key={dateKey}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{dateKey}</h3>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <div
                    key={slot._id}
                    className={`flex items-center gap-1.5 text-xs font-medium pl-3 py-1.5 rounded-full ${
                      slot.isBooked ? "bg-blue-100 text-blue-800 pr-3" : "bg-green-100 text-green-800 pr-1.5"
                    }`}
                    title={slot.isBooked ? "Booked" : "Open"}
                  >
                    {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                    {!slot.isBooked && (
                      <button
                        onClick={() => removeSlot(slot._id)}
                        aria-label="Remove slot"
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-green-200"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageAvailability;
