import { Link } from "react-router-dom";
import { StethoscopeIcon, StarIcon, ClockIcon, HeartIcon } from "./icons";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const formatNextAvailable = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
};

const DoctorCard = ({ doctor, isFavorite, onToggleFavorite, compareMode, compareChecked, onToggleCompare }) => (
  <div className="relative bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
    {onToggleFavorite && (
      <button
        type="button"
        onClick={() => onToggleFavorite(doctor._id)}
        aria-label={isFavorite ? "Remove from saved doctors" : "Save this doctor"}
        aria-pressed={isFavorite}
        className={`absolute top-4 right-4 p-1 rounded-full ${isFavorite ? "text-red-500" : "text-gray-300 hover:text-gray-400"}`}
      >
        <HeartIcon className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
      </button>
    )}

    <div className="flex items-start gap-3 mb-3 pr-7">
      <div className="w-11 h-11 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
        <StethoscopeIcon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{doctor.name}</h3>
        <p className="text-sm text-teal-700">{doctor.specialization || "General Practice"}</p>
        {doctor.reviewCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <StarIcon className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
            {doctor.averageRating} <span className="text-gray-400">({doctor.reviewCount})</span>
          </p>
        )}
      </div>
    </div>

    {doctor.location && <p className="text-sm text-gray-500 mb-1">📍 {doctor.location}</p>}
    <p className="text-xs text-gray-400 mb-2">
      {CONSULTATION_LABELS[doctor.consultationType] || CONSULTATION_LABELS["in-person"]}
    </p>
    <p className={`text-xs flex items-center gap-1.5 mb-4 ${doctor.nextAvailable ? "text-teal-700" : "text-gray-400"}`}>
      <ClockIcon className="w-3.5 h-3.5" />
      {doctor.nextAvailable ? `Next available: ${formatNextAvailable(doctor.nextAvailable)}` : "Fully booked"}
    </p>

    {compareMode ? (
      <label className="mt-auto flex items-center justify-center gap-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 px-3 py-2 cursor-pointer hover:bg-gray-50 has-[:checked]:border-teal-600 has-[:checked]:text-teal-700 has-[:checked]:bg-teal-50">
        <input
          type="checkbox"
          checked={compareChecked}
          onChange={() => onToggleCompare(doctor._id)}
          className="accent-teal-600"
        />
        Compare
      </label>
    ) : (
      <Link
        to={`/doctors/${doctor._id}`}
        className="mt-auto text-center text-sm font-medium rounded-md border border-teal-600 text-teal-700 px-3 py-2 hover:bg-teal-50"
      >
        View profile
      </Link>
    )}
  </div>
);

export default DoctorCard;
