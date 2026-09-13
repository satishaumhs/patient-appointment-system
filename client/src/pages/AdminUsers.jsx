import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import {
  ChevronLeftIcon,
  StethoscopeIcon,
  BriefcaseIcon,
  MapPinIcon,
  ClockIcon,
  CalendarIcon,
  StarIcon,
  VideoIcon,
} from "../components/icons";

const ROLE_STYLES = {
  doctor: "bg-blue-100 text-blue-800",
  admin: "bg-purple-100 text-purple-800",
};

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const CONSULTATION_BADGE_STYLES = {
  "in-person": "bg-gray-100 text-gray-600",
  video: "bg-violet-100 text-violet-700",
  both: "bg-gradient-to-r from-teal-100 to-violet-100 text-teal-800",
};

const TABS = [
  { value: "", label: "All" },
  { value: "doctor", label: "Doctors" },
  { value: "admin", label: "Admins" },
];

const formatNextAvailable = (iso) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const AdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleFilter = searchParams.get("role") || "";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await api.get("/users");
    setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setRoleFilter = (role) => {
    setSearchParams(role ? { role } : {});
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesSearch =
        !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.specialization?.toLowerCase().includes(term) ||
        u.location?.toLowerCase().includes(term);
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, search]);

  const counts = useMemo(() => {
    const c = { doctor: 0, admin: 0 };
    users.forEach((u) => {
      if (c[u.role] != null) c[u.role] += 1;
    });
    return c;
  }, [users]);

  const removeUser = async (id, name) => {
    if (!window.confirm(`Remove ${name}? This also deletes their appointments/slots.`)) {
      return;
    }

    setError("");
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove user");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Manage users</h1>

      <input
        type="text"
        placeholder="Search by name, email, specialization, or location..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-teal-600"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setRoleFilter(tab.value)}
            className={`text-sm font-medium px-3 py-1.5 rounded-full border ${
              roleFilter === tab.value
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-teal-500"
            }`}
          >
            {tab.label}
            {tab.value && <span className="ml-1.5 opacity-80">{counts[tab.value]}</span>}
            {!tab.value && <span className="ml-1.5 opacity-80">{users.length}</span>}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {filteredUsers.length === 0 ? (
        <p className="text-sm text-gray-500">
          {search ? "No users match your search." : "No users in this category."}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) =>
            u.role === "doctor" ? (
              <div key={u._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <StethoscopeIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-sm text-teal-700 truncate">{u.specialization || "General Practice"}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_STYLES.doctor}`}>doctor</span>
                    <button
                      onClick={() => removeUser(u._id, u.name)}
                      className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      CONSULTATION_BADGE_STYLES[u.consultationType] || CONSULTATION_BADGE_STYLES["in-person"]
                    }`}
                  >
                    {(u.consultationType === "video" || u.consultationType === "both") && (
                      <VideoIcon className="w-3 h-3" />
                    )}
                    {CONSULTATION_LABELS[u.consultationType] || CONSULTATION_LABELS["in-person"]}
                  </span>
                  {u.reviewCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                      <StarIcon className="w-3 h-3" fill="currentColor" />
                      {u.averageRating} ({u.reviewCount})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
                  {u.experience != null && (
                    <span className="flex items-center gap-1.5">
                      <BriefcaseIcon className="w-3.5 h-3.5 text-gray-400" />
                      {u.experience} {u.experience === 1 ? "year" : "years"} experience
                    </span>
                  )}
                  {u.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                      {u.location}
                    </span>
                  )}
                  {u.consultationFee != null && <span>₹{u.consultationFee} consultation fee</span>}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 pt-2 border-t border-gray-50 text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                    {u.totalAppointments} appointment{u.totalAppointments === 1 ? "" : "s"} total
                  </span>
                  {u.nextAvailable ? (
                    <span className="flex items-center gap-1.5 text-teal-700">
                      <ClockIcon className="w-3.5 h-3.5 text-teal-500" />
                      Next available: {formatNextAvailable(u.nextAvailable)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
                      No open slots
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div key={u._id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                <div>
                  <p className="font-medium text-gray-900">{u.name}</p>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_STYLES[u.role]}`}>
                    {u.role}
                  </span>
                  <button
                    onClick={() => removeUser(u._id, u.name)}
                    className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
