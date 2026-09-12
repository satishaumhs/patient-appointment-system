import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { StethoscopeIcon, BriefcaseIcon, GraduationCapIcon, MapPinIcon, StarIcon, BellIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const timeAgo = (iso) => {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};

const StarRow = ({ rating, size = "w-4 h-4" }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <StarIcon
        key={n}
        className={`${size} ${n <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
        fill={n <= Math.round(rating) ? "currentColor" : "none"}
      />
    ))}
  </div>
);

const DoctorProfile = () => {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [hasAvailability, setHasAvailability] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({ name: "", phone: "" });
  const [waitlistCode, setWaitlistCode] = useState("");
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [leavingWaitlist, setLeavingWaitlist] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault();
    setWaitlistError("");
    setWaitlistSubmitting(true);
    try {
      const res = await api.post("/waitlist", {
        doctorId: id,
        name: waitlistForm.name.trim(),
        phone: waitlistForm.phone,
      });
      setWaitlistCode(res.data.waitlistCode);
    } catch (err) {
      setWaitlistError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Could not join the waitlist");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!window.confirm("Leave the waitlist for this doctor?")) return;
    setLeaveError("");
    setLeavingWaitlist(true);
    try {
      await api.delete(`/waitlist/${waitlistCode}`, { data: { phone: waitlistForm.phone } });
      setWaitlistCode("");
      setWaitlistOpen(false);
      setWaitlistForm({ name: "", phone: "" });
    } catch (err) {
      setLeaveError(err.response?.data?.message || "Could not leave the waitlist");
    } finally {
      setLeavingWaitlist(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get(`/users/doctors/${id}`),
      api.get(`/availability/${id}`),
      api.get(`/users/doctors/${id}/reviews`),
    ])
      .then(([doctorRes, slotsRes, reviewsRes]) => {
        setDoctor(doctorRes.data);
        setHasAvailability(slotsRes.data.length > 0);
        setReviews(reviewsRes.data);
      })
      .catch(() => setError("Doctor not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center text-gray-500 text-sm">Loading...</div>;
  if (error || !doctor) return <div className="text-center text-red-600 text-sm">{error || "Not found"}</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-br from-teal-50 to-white p-6 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div className="w-20 h-20 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <StethoscopeIcon className="w-10 h-10" />
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                hasAvailability ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {hasAvailability ? "● Available" : "Fully booked"}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{doctor.name}</h1>
          <p className="text-teal-700 font-medium">{doctor.specialization || "General Practice"}</p>
          {doctor.reviewCount > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <StarRow rating={doctor.averageRating} />
              <span className="text-sm text-gray-600">
                {doctor.averageRating} ({doctor.reviewCount} review{doctor.reviewCount === 1 ? "" : "s"})
              </span>
            </div>
          )}
        </div>

        <div className="p-6 pt-5">
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5 text-sm">
            {doctor.experience != null && (
              <div className="flex items-center gap-2 text-gray-600">
                <BriefcaseIcon className="w-4 h-4 text-gray-400" />
                {doctor.experience} {doctor.experience === 1 ? "year" : "years"} experience
              </div>
            )}
            {doctor.qualification && (
              <div className="flex items-center gap-2 text-gray-600">
                <GraduationCapIcon className="w-4 h-4 text-gray-400" />
                {doctor.qualification}
              </div>
            )}
            {doctor.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPinIcon className="w-4 h-4 text-gray-400" />
                {doctor.location}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500">
            Consultation: {CONSULTATION_LABELS[doctor.consultationType] || CONSULTATION_LABELS["in-person"]}
          </p>

          {doctor.bio && (
            <>
              <h2 className="text-sm font-semibold text-gray-900 mt-5 mb-1.5">About</h2>
              <p className="text-sm text-gray-600">{doctor.bio}</p>
            </>
          )}

          <div className="flex items-center justify-between gap-4 pt-5 mt-5 border-t border-gray-100">
            {doctor.consultationFee != null ? (
              <div>
                <p className="text-xs text-gray-400">Consultation fee</p>
                <p className="text-lg font-semibold text-gray-900">₹{doctor.consultationFee}</p>
              </div>
            ) : (
              <div />
            )}

            {hasAvailability ? (
              <Link
                to={`/book?doctorId=${doctor._id}`}
                className="rounded-md bg-teal-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-teal-700"
              >
                Book an appointment
              </Link>
            ) : (
              !waitlistOpen &&
              !waitlistCode && (
                <button
                  type="button"
                  onClick={() => setWaitlistOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-teal-600 text-teal-700 px-5 py-2.5 text-sm font-medium hover:bg-teal-50"
                >
                  <BellIcon className="w-4 h-4" />
                  Notify me when open
                </button>
              )
            )}
          </div>

          {!hasAvailability && (waitlistOpen || waitlistCode) && (
            <div className="pt-5 mt-5 border-t border-gray-100">
              {waitlistCode ? (
                <div className="bg-teal-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-teal-900 mb-1">You're on the waitlist</p>
                  <p className="text-xs text-teal-700">
                    We'll note it if a slot opens up. Your code: <b>{waitlistCode}</b> — check back on this page,
                    it'll show as available the moment a slot opens.
                  </p>
                  {leaveError && <p className="text-xs text-red-600 mt-2">{leaveError}</p>}
                  <button
                    type="button"
                    onClick={handleLeaveWaitlist}
                    disabled={leavingWaitlist}
                    className="text-xs font-medium text-teal-700 hover:underline mt-2 disabled:opacity-50"
                  >
                    {leavingWaitlist ? "Leaving..." : "Changed your mind? Leave the waitlist"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="space-y-3 max-w-sm">
                  <p className="text-sm font-medium text-gray-900">Get notified when a slot opens</p>
                  <input
                    placeholder="Your name"
                    value={waitlistForm.name}
                    onChange={(e) => setWaitlistForm({ ...waitlistForm, name: e.target.value })}
                    required
                    className={inputClass}
                  />
                  <input
                    placeholder="Mobile number"
                    type="tel"
                    inputMode="numeric"
                    value={waitlistForm.phone}
                    onChange={(e) =>
                      setWaitlistForm({ ...waitlistForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    maxLength={10}
                    required
                    className={inputClass}
                  />
                  {waitlistError && <p className="text-xs text-red-600">{waitlistError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWaitlistOpen(false)}
                      className="rounded-md border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={waitlistSubmitting || waitlistForm.phone.length !== 10 || !waitlistForm.name.trim()}
                      className="flex-1 rounded-md bg-teal-600 text-white py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    >
                      {waitlistSubmitting ? "Joining..." : "Join waitlist"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="pt-5 mt-5 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Reviews {reviews.length > 0 && `(${reviews.length})`}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-gray-500">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r._id} className="pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{r.patientName}</p>
                      <p className="text-xs text-gray-400">{timeAgo(r.createdAt)}</p>
                    </div>
                    <StarRow rating={r.rating} size="w-3.5 h-3.5" />
                    {r.comment && <p className="text-sm text-gray-600 mt-1.5">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile;
