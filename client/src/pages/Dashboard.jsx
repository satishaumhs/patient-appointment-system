import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import StatusDonut from "../components/StatusDonut";
import WeekBarChart from "../components/WeekBarChart";
import ReschedulePanel from "../components/ReschedulePanel";
import { CalendarIcon, ClockIcon, CheckCircleIcon, UsersIcon, StethoscopeIcon, VideoIcon } from "../components/icons";
import { isVideoCallJoinable, isVideoCallUpcoming } from "../utils/videoCall";

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
};

const TITLES = {
  doctor: "Your schedule",
  admin: "All appointments",
};

const emptyCounts = () => ({ pending: 0, confirmed: 0, completed: 0, rejected: 0, cancelled: 0 });

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [userCounts, setUserCounts] = useState({ doctor: 0 });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reschedulingId, setReschedulingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const requests = [api.get("/appointments")];
    if (user.role === "admin") requests.push(api.get("/users"));

    const [apptRes, usersRes] = await Promise.all(requests);
    setAppointments(apptRes.data);

    if (usersRes) {
      const counts = { doctor: 0 };
      usersRes.data.forEach((u) => {
        if (u.role === "doctor") counts.doctor += 1;
      });
      setUserCounts(counts);
    }
    setLoading(false);
  }, [user.role]);

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

  const markPaid = async (id) => {
    setActionError("");
    try {
      await api.patch(`/appointments/${id}/mark-paid`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not mark as paid");
    }
  };

  const statusCounts = useMemo(() => {
    const counts = emptyCounts();
    appointments.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  const weekData = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    return days.map((d) => ({
      label: d.toLocaleDateString([], { weekday: "short" }),
      count: appointments.filter((a) => new Date(a.date).toDateString() === d.toDateString()).length,
    }));
  }, [appointments]);

  const uniquePatients = useMemo(() => {
    // "Seen" means an actual completed visit -- pending/confirmed haven't
    // happened yet, and rejected never happened at all.
    const phones = appointments.filter((a) => a.status === "completed").map((a) => a.patientInfo?.phone);
    return new Set(phones.filter(Boolean)).size;
  }, [appointments]);

  const filteredAppointments = useMemo(
    () => (statusFilter ? appointments.filter((a) => a.status === statusFilter) : appointments),
    [appointments, statusFilter]
  );

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">{TITLES[user.role]}</h1>

      <div className={`grid grid-cols-2 gap-4 mb-6 ${user.role === "admin" ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        {user.role === "doctor" && (
          <>
            <StatCard icon={ClockIcon} label="Awaiting response" value={statusCounts.pending} tint="amber" />
            <StatCard icon={CheckCircleIcon} label="Confirmed" value={statusCounts.confirmed} tint="blue" />
            <StatCard icon={CheckCircleIcon} label="Completed" value={statusCounts.completed} tint="teal" />
            <StatCard icon={UsersIcon} label="Patients seen" value={uniquePatients} tint="purple" />
          </>
        )}
        {user.role === "admin" && (
          <>
            <StatCard
              icon={CalendarIcon}
              label="Total appointments"
              value={appointments.length}
              tint="blue"
              active={statusFilter === ""}
              onClick={() => setStatusFilter("")}
            />
            <StatCard
              icon={ClockIcon}
              label="Pending"
              value={statusCounts.pending}
              tint="amber"
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
            />
            <StatCard
              icon={StethoscopeIcon}
              label="Doctors"
              value={userCounts.doctor}
              tint="teal"
              onClick={() => navigate("/admin/users?role=doctor")}
            />
          </>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Appointments this week</h2>
          <WeekBarChart data={weekData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Status breakdown</h2>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-500">No appointments yet.</p>
          ) : (
            <StatusDonut
              counts={statusCounts}
              activeKey={user.role === "admin" ? statusFilter : ""}
              onSelect={user.role === "admin" ? setStatusFilter : undefined}
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            {user.role === "admin"
              ? statusFilter
                ? `${statusFilter[0].toUpperCase()}${statusFilter.slice(1)} appointments`
                : "All appointments"
              : "Appointment requests"}
          </h2>
          {user.role === "admin" && statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

        {filteredAppointments.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {statusFilter ? `No ${statusFilter} appointments.` : "No appointments yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((appt) => (
              <div key={appt._id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {appt.patientInfo?.name}
                      {user.role === "admin" && ` → ${appt.doctor?.name}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {appt.patientInfo?.age} yrs • {appt.patientInfo?.gender} • {new Date(appt.date).toLocaleString()}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                    {appt.status === "confirmed" && appt.appointmentType === "video" && appt.videoLink && (
                      isVideoCallJoinable(appt) ? (
                        <a
                          href={appt.videoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:underline mt-1"
                        >
                          <VideoIcon className="w-3.5 h-3.5" />
                          Join video call
                        </a>
                      ) : (
                        isVideoCallUpcoming(appt) && (
                          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 mt-1">
                            <VideoIcon className="w-3.5 h-3.5" />
                            Video call opens 10 min before the appointment
                          </p>
                        )
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {appt.payment?.status === "paid" && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                        Paid
                      </span>
                    )}
                    {appt.payment?.status === "pending" && (
                      <>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                          Payment pending
                        </span>
                        {appt.appointmentType !== "video" && (
                          new Date(appt.date) <= new Date() ? (
                            <button
                              onClick={() => markPaid(appt._id)}
                              title="Record that this patient paid in cash at the clinic"
                              className="text-xs px-2 py-1 rounded-md border border-teal-600 text-teal-700 hover:bg-teal-50"
                            >
                              Mark paid (cash)
                            </button>
                          ) : (
                            <span
                              title="Cash can only be marked as paid once the appointment date arrives"
                              className="text-xs text-gray-400"
                            >
                              Mark paid (cash) — available on the appointment date
                            </span>
                          )
                        )}
                      </>
                    )}
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
                          Accept
                        </button>
                        <button
                          onClick={() => setReschedulingId(reschedulingId === appt._id ? null : appt._id)}
                          className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => updateStatus(appt._id, "rejected")}
                          className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {user.role === "doctor" && appt.status === "confirmed" && (
                      <>
                        <button
                          onClick={() => updateStatus(appt._id, "completed")}
                          className="text-xs px-2 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-700"
                        >
                          Mark complete
                        </button>
                        <button
                          onClick={() => setReschedulingId(reschedulingId === appt._id ? null : appt._id)}
                          className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Reschedule
                        </button>
                      </>
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

                {reschedulingId === appt._id && (
                  <ReschedulePanel
                    appointmentId={appt._id}
                    onCancel={() => setReschedulingId(null)}
                    onRescheduled={() => {
                      setReschedulingId(null);
                      load();
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
