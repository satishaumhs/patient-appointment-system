import { useEffect, useState } from "react";
import api from "../api/axios";

const ROLE_STYLES = {
  patient: "bg-gray-100 text-gray-700",
  doctor: "bg-blue-100 text-blue-800",
  admin: "bg-purple-100 text-purple-800",
};

const AdminUsers = () => {
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
    <div className="max-w-3xl mx-auto mt-10 px-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Manage users</h1>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-2">
        {users.map((u) => (
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
    </div>
  );
};

export default AdminUsers;
