import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { ChevronLeftIcon } from "../components/icons";

const ROLE_STYLES = {
  doctor: "bg-blue-100 text-blue-800",
  admin: "bg-purple-100 text-purple-800",
};

const TABS = [
  { value: "", label: "All" },
  { value: "doctor", label: "Doctors" },
  { value: "admin", label: "Admins" },
];

const AdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleFilter = searchParams.get("role") || "";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const filteredUsers = useMemo(
    () => (roleFilter ? users.filter((u) => u.role === roleFilter) : users),
    [users, roleFilter]
  );

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
    <div className="max-w-3xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Manage users</h1>

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
        <p className="text-sm text-gray-500">No users in this category.</p>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between border border-gray-200 rounded-lg p-4"
            >
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
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
