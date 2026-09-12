import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const FEATURES = [
  {
    title: "Find the right doctor",
    tint: "teal",
    description: "Browse doctors on the platform and pick who's right for your visit.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Book instantly",
    tint: "violet",
    description: "See real, open time slots and reserve one in seconds — no phone calls.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="3" x2="8" y2="7" strokeLinecap="round" />
        <line x1="16" y1="3" x2="16" y2="7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "No account needed",
    tint: "teal",
    description: "Just tell us who you are when you book. Check your status anytime with your reference number.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const ICON_TINTS = {
  teal: "bg-teal-100 text-teal-700",
  violet: "bg-violet-100 text-violet-700",
};

const Landing = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/users/doctors").then((res) => {
      const specializations = new Set(res.data.map((d) => d.specialization).filter(Boolean));
      setStats({ doctors: res.data.length, specializations: specializations.size });
    });
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50 via-white to-white">
        <div
          className="absolute -top-24 right-[-10%] w-96 h-96 rounded-full bg-violet-200/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-teal-700 bg-teal-100 rounded-full px-4 py-1.5 mb-6">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M4.5 3v6.5a4 4 0 0 0 8 0V3" />
              <path d="M8.5 13.5v1a6.5 6.5 0 0 0 13 0v-3.5" />
              <circle cx="20" cy="8.5" r="2.3" />
            </svg>
            Online appointment booking
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-teal-950 leading-tight max-w-3xl mx-auto text-balance">
            Book a doctor's appointment in minutes.
          </h1>
          <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
            No account needed. Just tell us who you are and when works for you — we'll take it
            from there.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/book"
              className="w-full sm:w-auto rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700 transition-colors"
            >
              Book an appointment
            </Link>
            <Link
              to="/doctors"
              className="w-full sm:w-auto rounded-md border border-gray-300 text-gray-700 px-6 py-3 font-medium hover:border-gray-400 transition-colors"
            >
              Find a Doctor
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Already booked?{" "}
            <Link to="/status" className="text-teal-700 font-medium hover:underline">
              Check your appointment status
            </Link>
          </p>

          {stats && (
            <div className="mt-12 inline-flex items-center gap-6 text-sm text-gray-500 bg-white/80 border border-gray-200 rounded-full px-6 py-3">
              <span>
                <b className="text-gray-900 font-semibold">{stats.doctors}</b> doctors
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
              <span>
                <b className="text-gray-900 font-semibold">{stats.specializations}</b> specialties
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
              <span>Booking open now</span>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center sm:text-left">
              <div
                className={`inline-flex items-center justify-center w-11 h-11 rounded-lg mb-4 ${ICON_TINTS[f.tint]}`}
              >
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} My Health School
        </div>
      </footer>
    </div>
  );
};

export default Landing;
