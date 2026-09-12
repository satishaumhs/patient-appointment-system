import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import DoctorCard from "../components/DoctorCard";
import { HeartIcon, ScaleIcon, XIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const SORT_OPTIONS = [
  { value: "next-available", label: "Sort: Soonest available" },
  { value: "rating", label: "Sort: Highest rated" },
  { value: "name", label: "Sort: Name (A-Z)" },
];

const FAVORITES_KEY = "mhs_saved_doctors";
const MAX_COMPARE = 3;

const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const CONSULTATION_LABELS = { "in-person": "In-person", video: "Video consultation", both: "In-person & video" };

const formatNextAvailable = (iso) => {
  if (!iso) return "Fully booked";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const FindDoctor = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [sortBy, setSortBy] = useState("next-available");
  const [favorites, setFavorites] = useState(loadFavorites);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);

  useEffect(() => {
    api.get("/users/doctors").then((res) => {
      setDoctors(res.data);
      setLoading(false);
    });
  }, []);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage unavailable (private mode, blocked cookies) -- favorites just won't persist
      }
      return next;
    });
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareIds([]);
  };

  const specializations = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return [...set].sort();
  }, [doctors]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = doctors.filter((d) => {
      const matchesSearch =
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.location || "").toLowerCase().includes(term) ||
        (d.specialization || "").toLowerCase().includes(term);
      const matchesSpecialization = !specialization || d.specialization === specialization;
      const matchesFavorite = !favoritesOnly || favorites.has(d._id);
      return matchesSearch && matchesSpecialization && matchesFavorite;
    });

    const sorted = [...matches];
    if (sortBy === "next-available") {
      sorted.sort((a, b) => {
        if (!a.nextAvailable && !b.nextAvailable) return a.name.localeCompare(b.name);
        if (!a.nextAvailable) return 1;
        if (!b.nextAvailable) return -1;
        return new Date(a.nextAvailable) - new Date(b.nextAvailable);
      });
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0) || a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [doctors, search, specialization, sortBy, favoritesOnly, favorites]);

  const compareDoctors = compareIds.map((id) => doctors.find((d) => d._id === id)).filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
        <h1 className="text-2xl font-semibold text-gray-900">Find a doctor</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border ${
              favoritesOnly ? "bg-red-50 border-red-200 text-red-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <HeartIcon className="w-3.5 h-3.5" fill={favoritesOnly ? "currentColor" : "none"} />
            Saved {favorites.size > 0 && `(${favorites.size})`}
          </button>
          <button
            type="button"
            onClick={() => (compareMode ? exitCompare() : setCompareMode(true))}
            className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border ${
              compareMode ? "bg-teal-50 border-teal-200 text-teal-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ScaleIcon className="w-3.5 h-3.5" />
            {compareMode ? "Exit compare" : "Compare"}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {compareMode ? `Select up to ${MAX_COMPARE} doctors to compare side by side.` : "Search by specialty, name, or location."}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, specialty, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} sm:max-w-sm`}
        />
        <select
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          className={`${inputClass} sm:max-w-xs`}
        >
          <option value="">All specializations</option>
          {specializations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputClass} sm:max-w-xs`}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading doctors...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {favoritesOnly ? "You haven't saved any doctors yet." : "No doctors match your search."}
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {filtered.map((doctor) => (
            <DoctorCard
              key={doctor._id}
              doctor={doctor}
              isFavorite={favorites.has(doctor._id)}
              onToggleFavorite={toggleFavorite}
              compareMode={compareMode}
              compareChecked={compareIds.includes(doctor._id)}
              onToggleCompare={toggleCompare}
            />
          ))}
        </div>
      )}

      {compareMode && compareDoctors.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sticky bottom-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Comparing {compareDoctors.length} doctors</h2>
            <button type="button" onClick={exitCompare} className="text-gray-400 hover:text-gray-600">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-xs text-gray-400 font-medium pb-3 pr-4 w-32">&nbsp;</th>
                  {compareDoctors.map((d) => (
                    <th key={d._id} className="text-left pb-3 pr-6 font-semibold text-gray-900 min-w-[160px]">
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr]:border-t [&_tr]:border-gray-100 [&_td]:py-2.5 [&_td]:pr-6">
                <tr>
                  <td className="text-xs text-gray-400">Specialty</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>{d.specialization || "General Practice"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-xs text-gray-400">Location</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>{d.location || "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-xs text-gray-400">Experience</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>{d.experience != null ? `${d.experience} yrs` : "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-xs text-gray-400">Consultation</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>{CONSULTATION_LABELS[d.consultationType] || CONSULTATION_LABELS["in-person"]}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-xs text-gray-400">Fee</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>{d.consultationFee != null ? `₹${d.consultationFee}` : "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-xs text-gray-400">Rating</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>{d.reviewCount > 0 ? `${d.averageRating} (${d.reviewCount})` : "No reviews yet"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="text-xs text-gray-400">Next available</td>
                  {compareDoctors.map((d) => (
                    <td key={d._id} className={d.nextAvailable ? "text-teal-700 font-medium" : "text-gray-400"}>
                      {formatNextAvailable(d.nextAvailable)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td></td>
                  {compareDoctors.map((d) => (
                    <td key={d._id}>
                      <a href={`/doctors/${d._id}`} className="text-teal-700 font-medium hover:underline">
                        View profile →
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindDoctor;
