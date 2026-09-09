import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { StethoscopeIcon } from "../components/icons";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const DoctorProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/users/doctors/${id}`)
      .then((res) => setDoctor(res.data))
      .catch(() => setError("Doctor not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center text-gray-500 text-sm">Loading...</div>;
  if (error || !doctor) return <div className="text-center text-red-600 text-sm">{error || "Not found"}</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <StethoscopeIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{doctor.name}</h1>
            <p className="text-teal-700 font-medium">{doctor.specialization || "General Practice"}</p>
          </div>
        </div>

        <dl className="grid sm:grid-cols-2 gap-4 mb-5 text-sm">
          {doctor.location && (
            <div>
              <dt className="text-gray-400">Location</dt>
              <dd className="text-gray-900">{doctor.location}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-400">Consultation</dt>
            <dd className="text-gray-900">
              {CONSULTATION_LABELS[doctor.consultationType] || CONSULTATION_LABELS["in-person"]}
            </dd>
          </div>
        </dl>

        {doctor.bio && <p className="text-sm text-gray-600 mb-6">{doctor.bio}</p>}

        {user?.role === "patient" && (
          <Link
            to={`/book?doctorId=${doctor._id}`}
            className="inline-block rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700"
          >
            Book an appointment
          </Link>
        )}
      </div>
    </div>
  );
};

export default DoctorProfile;
