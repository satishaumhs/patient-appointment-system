import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import DoctorCard from "../components/DoctorCard";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const FindDoctor = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");

  useEffect(() => {
    api.get("/users/doctors").then((res) => {
      setDoctors(res.data);
      setLoading(false);
    });
  }, []);

  const specializations = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return [...set].sort();
  }, [doctors]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return doctors.filter((d) => {
      const matchesSearch =
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.location || "").toLowerCase().includes(term) ||
        (d.specialization || "").toLowerCase().includes(term);
      const matchesSpecialization = !specialization || d.specialization === specialization;
      return matchesSearch && matchesSpecialization;
    });
  }, [doctors, search, specialization]);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Find a doctor</h1>
      <p className="text-sm text-gray-500 mb-6">Search by specialty, name, or location.</p>

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
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading doctors...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No doctors match your search.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doctor) => (
            <DoctorCard key={doctor._id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FindDoctor;
