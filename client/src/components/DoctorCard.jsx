import { Link } from "react-router-dom";
import { StethoscopeIcon } from "./icons";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const DoctorCard = ({ doctor }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
    <div className="flex items-start gap-3 mb-3">
      <div className="w-11 h-11 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
        <StethoscopeIcon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{doctor.name}</h3>
        <p className="text-sm text-teal-700">{doctor.specialization || "General Practice"}</p>
      </div>
    </div>

    {doctor.location && <p className="text-sm text-gray-500 mb-1">📍 {doctor.location}</p>}
    <p className="text-xs text-gray-400 mb-4">
      {CONSULTATION_LABELS[doctor.consultationType] || CONSULTATION_LABELS["in-person"]}
    </p>

    <Link
      to={`/doctors/${doctor._id}`}
      className="mt-auto text-center text-sm font-medium rounded-md border border-teal-600 text-teal-700 px-3 py-2 hover:bg-teal-50"
    >
      View profile
    </Link>
  </div>
);

export default DoctorCard;
