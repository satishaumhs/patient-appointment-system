import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900";

const BookAppointment = () => {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/users/doctors").then((res) => setDoctors(res.data));
  }, []);

  useEffect(() => {
    setSlotId("");
    setSlots([]);
    if (!doctorId || !date) return;

    setLoadingSlots(true);
    api
      .get(`/availability/${doctorId}`, { params: { date } })
      .then((res) => setSlots(res.data))
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/appointments", { slotId, reason });
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          "Booking failed"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 px-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Book an appointment</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <select
            id="doctor"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Select a doctor
            </option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={!doctorId}
            className={inputClass}
          />
        </div>
        {doctorId && date && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Available times</label>
            {loadingSlots ? (
              <p className="text-sm text-gray-500">Loading times...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500">No open slots that day. Try another date.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot._id}
                    type="button"
                    onClick={() => setSlotId(slot._id)}
                    className={`text-sm px-2 py-2 rounded-md border ${
                      slotId === slot._id
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-300 text-gray-700 hover:border-gray-900"
                    }`}
                  >
                    {new Date(slot.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for visit</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !slotId}
          className="w-full rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Booking..." : "Book appointment"}
        </button>
      </form>
    </div>
  );
};

export default BookAppointment;
