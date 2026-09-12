import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import DemoPaymentForm from "../components/DemoPaymentForm";
import {
  TicketIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  StarIcon,
  UsersIcon,
  ChevronLeftIcon,
} from "../components/icons";
import { isVideoCallJoinable, isVideoCallUpcoming } from "../utils/videoCall";

const inputClass =
  "w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";
const plainInputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-700",
};

const CANCELLABLE_STATUSES = ["pending", "confirmed"];

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatWhen = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        aria-label={`${n} star${n === 1 ? "" : "s"}`}
        className={n <= value ? "text-amber-400" : "text-gray-300"}
      >
        <StarIcon className="w-6 h-6" fill={n <= value ? "currentColor" : "none"} />
      </button>
    ))}
  </div>
);

const AppointmentStatus = () => {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewDone, setReviewDone] = useState(false);

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
      setReviewDone(false);
      setCancelConfirming(false);
    } catch (err) {
      setError(err.response?.data?.message || "No appointment found for that reference number and phone number");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelError("");
    setCancelSubmitting(true);
    try {
      const res = await api.post(`/appointments/status/${result.referenceNumber}/cancel`, { phone: phone.trim() });
      setResult({ ...result, status: res.data.status });
      setCancelConfirming(false);
    } catch (err) {
      setCancelError(err.response?.data?.message || "Could not cancel this appointment");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError("");
    setReviewSubmitting(true);
    try {
      await api.post(`/appointments/status/${result.referenceNumber}/review`, {
        phone: phone.trim(),
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewDone(true);
    } catch (err) {
      setReviewError(err.response?.data?.message || "Could not submit your review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to home
      </Link>
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
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
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

          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[result.status]}`}>
            {result.status}
          </span>

          {result.status === "confirmed" && result.queuePosition != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 rounded-full px-2.5 py-1">
              <UsersIcon className="w-3.5 h-3.5" />
              {result.queuePosition === 0
                ? "You're first up that day"
                : `${result.queuePosition} patient${result.queuePosition === 1 ? "" : "s"} ahead of you that day`}
            </p>
          )}

          {result.videoLink && (
            isVideoCallJoinable(result) ? (
              <a
                href={result.videoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-md bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700"
              >
                <VideoIcon className="w-4 h-4" />
                Join video consultation
              </a>
            ) : (
              isVideoCallUpcoming(result) && (
                <p className="mt-4 flex items-center justify-center gap-2 rounded-md bg-gray-100 text-gray-500 py-2.5 text-sm font-medium">
                  <VideoIcon className="w-4 h-4" />
                  Video call opens 10 minutes before your appointment
                </p>
              )
            )
          )}

          {result.payment && result.payment.status !== "not_required" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <DemoPaymentForm
                payment={result.payment}
                appointmentStatus={result.status}
                referenceNumber={result.referenceNumber}
                phone={phone.trim()}
                onPaid={(payment) => setResult({ ...result, payment })}
              />
            </div>
          )}

          {CANCELLABLE_STATUSES.includes(result.status) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {!cancelConfirming ? (
                <button
                  type="button"
                  onClick={() => setCancelConfirming(true)}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Cancel this appointment
                </button>
              ) : (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-sm text-red-800 mb-2">Are you sure you want to cancel this appointment?</p>
                  {cancelError && <p className="text-xs text-red-600 mb-2">{cancelError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCancelConfirming(false)}
                      className="rounded-md border border-gray-300 bg-white text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelSubmitting}
                      className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelSubmitting ? "Cancelling..." : "Yes, cancel it"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {result.status === "completed" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="mb-4 w-full rounded-md border border-gray-300 text-gray-700 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Download visit summary
              </button>
              {result.hasReview || reviewDone ? (
                <p className="text-sm text-gray-500">Thanks for rating your visit!</p>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Rate your visit</p>
                  <StarPicker value={reviewRating} onChange={setReviewRating} />
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)"
                    rows={2}
                    className={plainInputClass}
                  />
                  {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                  <button
                    type="submit"
                    disabled={reviewSubmitting || reviewRating === 0}
                    className="rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-40"
                  >
                    {reviewSubmitting ? "Submitting..." : "Submit review"}
                  </button>
                </form>
              )}
            </div>
          )}

          {result.timeline?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-900 mb-2">Updates</p>
              <div className="space-y-2.5">
                {result.timeline.map((entry, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-800">{entry.title}</p>
                      <p className="text-xs text-gray-400">{formatWhen(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.status === "completed" && (
            <div className="hidden print:block print-summary p-10">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Visit summary</h1>
              <p className="text-sm text-gray-500 mb-6">My Health School — reference {result.referenceNumber}</p>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-500 w-40">Patient</td>
                    <td className="py-2 font-medium text-gray-900">
                      {result.patientInfo?.name} — {result.patientInfo?.age} yrs, {result.patientInfo?.gender}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-500">Doctor</td>
                    <td className="py-2 font-medium text-gray-900">
                      {result.doctor?.name} · {result.doctor?.specialization || "General Practice"}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-500">Date &amp; time</td>
                    <td className="py-2 font-medium text-gray-900">{formatWhen(result.date)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-500">Reason for visit</td>
                    <td className="py-2 font-medium text-gray-900">{result.reason || "Not specified"}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-500">Status</td>
                    <td className="py-2 font-medium text-gray-900 capitalize">{result.status}</td>
                  </tr>
                  {result.payment && result.payment.status !== "not_required" && (
                    <tr className="border-b border-gray-200">
                      <td className="py-2 pr-4 text-gray-500">Payment</td>
                      <td className="py-2 font-medium text-gray-900">
                        ₹{result.payment.amount} — {result.payment.status === "paid" ? "Paid" : "Pending"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-8">Generated from myhealthschool.com/status — not a legal medical record.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentStatus;
