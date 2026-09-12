import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import StatCard from "../components/StatCard";
import StatusDonut from "../components/StatusDonut";
import { CalendarIcon, CreditCardIcon, XCircleIcon, ClockIcon, ChevronLeftIcon, BellIcon } from "../components/icons";

const formatHour = (h) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric" });
};

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [waitlist, setWaitlist] = useState([]);

  useEffect(() => {
    api.get("/analytics").then((res) => setData(res.data));
    api.get("/waitlist").then((res) => setWaitlist(res.data));
  }, []);

  const waitlistByDoctor = useMemo(() => {
    const byDoctor = new Map();
    waitlist.forEach((entry) => {
      const key = entry.doctor?._id;
      if (!key) return;
      if (!byDoctor.has(key)) {
        byDoctor.set(key, { name: entry.doctor.name, specialization: entry.doctor.specialization, count: 0 });
      }
      byDoctor.get(key).count += 1;
    });
    return [...byDoctor.values()].sort((a, b) => b.count - a.count);
  }, [waitlist]);

  if (!data) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  const totalRevenue = data.revenueBySpecialization.reduce((sum, r) => sum + r.revenue, 0);
  const maxRevenue = Math.max(1, ...data.revenueBySpecialization.map((r) => r.revenue));
  const maxHourCount = Math.max(1, ...data.busiestHours.map((h) => h.count));
  const hourMap = Object.fromEntries(data.busiestHours.map((h) => [h.hour, h.count]));
  const displayHours = [...Array(15)].map((_, i) => i + 7); // 7am - 9pm, the clinic's actual hours

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">Real numbers from every appointment ever booked on the platform.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CalendarIcon} label="Total appointments" value={data.totalAppointments} tint="blue" />
        <StatCard icon={CreditCardIcon} label="Revenue collected" value={`₹${totalRevenue.toLocaleString()}`} tint="teal" />
        <StatCard icon={XCircleIcon} label="Cancelled / rejected rate" value={`${data.noShowRate}%`} tint="red" />
        <StatCard
          icon={ClockIcon}
          label="Busiest hour"
          value={data.busiestHours.length > 0 ? formatHour(data.busiestHours.reduce((a, b) => (b.count > a.count ? b : a)).hour) : "—"}
          tint="purple"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue by specialization</h2>
          {data.revenueBySpecialization.length === 0 ? (
            <p className="text-sm text-gray-500">No paid appointments yet.</p>
          ) : (
            <div className="space-y-3">
              {data.revenueBySpecialization.map((r) => (
                <div key={r.specialization}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{r.specialization}</span>
                    <span className="text-gray-500 tabular-nums">
                      ₹{r.revenue.toLocaleString()} · {r.paidVisits} visit{r.paidVisits === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-violet-500"
                      style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Status breakdown</h2>
          {data.totalAppointments === 0 ? (
            <p className="text-sm text-gray-500">No appointments yet.</p>
          ) : (
            <StatusDonut counts={data.statusCounts} />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Busiest hours</h2>
        <p className="text-xs text-gray-500 mb-4">Appointment volume by hour of day, clinic time (IST).</p>
        <div className="flex items-end justify-between gap-1.5 h-36">
          {displayHours.map((h) => {
            const count = hourMap[h] || 0;
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="flex-1 w-full flex items-end justify-center">
                  <div
                    className="w-full max-w-7 rounded-t-md bg-gradient-to-t from-teal-500 to-violet-500"
                    style={{ height: count > 0 ? `${(count / maxHourCount) * 100}%` : "3px" }}
                    title={`${count} appointment${count === 1 ? "" : "s"}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatHour(h)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <BellIcon className="w-4 h-4 text-violet-600" />
          <h2 className="text-sm font-semibold text-gray-900">Waitlist demand</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Patients waiting on a fully-booked doctor, across the whole platform -- a signal for where to open more
          slots.
        </p>
        {waitlistByDoctor.length === 0 ? (
          <p className="text-sm text-gray-500">No one is currently waiting on a doctor.</p>
        ) : (
          <div className="space-y-2">
            {waitlistByDoctor.map((d) => (
              <div key={d.name + d.specialization} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900">{d.name}</span>
                  {d.specialization && <span className="text-gray-500"> · {d.specialization}</span>}
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-violet-50 text-violet-700 tabular-nums">
                  {d.count} waiting
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
