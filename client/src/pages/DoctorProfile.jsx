import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { StethoscopeIcon, BriefcaseIcon, GraduationCapIcon, MapPinIcon, StarIcon } from "../components/icons";

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

            <Link
              to={`/book?doctorId=${doctor._id}`}
              className="rounded-md bg-teal-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-teal-700"
            >
              Book an appointment
            </Link>
          </div>

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
