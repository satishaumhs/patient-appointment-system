import { useState } from "react";
import api from "../api/axios";
import { TicketIcon, PhoneIcon, CalendarIcon, ClockIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-700",
};

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const AppointmentStatus = () => {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const res = await api.post(`/appointments/status/${referenceNumber.trim().toUpperCase()}`, {
        phone: phone.trim(),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "No appointment found for that reference number and phone number");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Check appointment status</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter the reference number and mobile number you used when booking.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="referenceNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Reference number
            </label>
            <div className="relative">
              <TicketIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="referenceNumber"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="MHS-12345"
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Mobile number
            </label>
            <div className="relative">
              <PhoneIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? "Checking..." : "Check status"}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-5">
          <p className="text-xs text-gray-400 mb-1">Appointment {result.referenceNumber}</p>
          <p className="font-semibold text-gray-900 mb-3">{result.patientName}</p>

          <div className="space-y-1.5 text-sm text-gray-700 mb-4">
            <p className="font-medium text-gray-900">{result.doctor?.name}</p>
            <p className="text-gray-500">{result.doctor?.specialization || "General Practice"}</p>
            <p className="flex items-center gap-1.5 pt-1.5">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              {new Date(result.date).toLocaleDateString([], { dateStyle: "medium" })}
            </p>
            <p className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-gray-400" />
              {formatTime(result.date)}
            </p>
          </div>

          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[result.status]}`}
          >
            {result.status}
          </span>
        </div>
      )}
    </div>
  );
};

export default AppointmentStatus;
