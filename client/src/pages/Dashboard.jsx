import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const TITLES = {
  patient: "My appointments",
  doctor: "Your schedule",
  admin: "All appointments",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get("/appointments");
    setAppointments(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id, status) => {
    setActionError("");
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || "Action failed");
    }
  };

  const removeAppointment = async (id) => {
    setActionError("");
    try {
      await api.delete(`/appointments/${id}`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || "Delete failed");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{TITLES[user.role]}</h1>
        {user.role === "patient" && (
          <Link
            to="/book"
            className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
          >
            Book appointment
          </Link>
        )}
      </div>

      {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

      {appointments.length === 0 ? (
        <p className="text-gray-500">No appointments yet.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div
              key={appt._id}
              className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {user.role === "patient" ? `Dr. ${appt.doctor?.name}` : appt.patient?.name}
                  {user.role === "admin" && ` → Dr. ${appt.doctor?.name}`}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(appt.date).toLocaleString()} · {appt.reason}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[appt.status]}`}
                >
                  {appt.status}
                </span>
                {user.role === "doctor" && appt.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(appt._id, "confirmed")}
                      className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => updateStatus(appt._id, "cancelled")}
                      className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                      Decline
                    </button>
                  </>
                )}
                {user.role === "doctor" && appt.status === "confirmed" && (
                  <button
                    onClick={() => updateStatus(appt._id, "completed")}
                    className="text-xs px-2 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                  >
                    Mark complete
                  </button>
                )}
                {user.role === "patient" && ["pending", "confirmed"].includes(appt.status) && (
                  <button
                    onClick={() => updateStatus(appt._id, "cancelled")}
                    className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                  >
                    Cancel
                  </button>
                )}
                {user.role === "admin" && (
                  <button
                    onClick={() => removeAppointment(appt._id)}
                    className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
