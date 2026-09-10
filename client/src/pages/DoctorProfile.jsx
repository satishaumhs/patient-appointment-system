import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { StethoscopeIcon, BriefcaseIcon, GraduationCapIcon, MapPinIcon } from "../components/icons";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const DoctorProfile = () => {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [hasAvailability, setHasAvailability] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get(`/users/doctors/${id}`), api.get(`/availability/${id}`)])
      .then(([doctorRes, slotsRes]) => {
        setDoctor(doctorRes.data);
        setHasAvailability(slotsRes.data.length > 0);
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
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile;
