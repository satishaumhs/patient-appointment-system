import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Find the right doctor",
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
    title: "Manage with ease",
    description: "Track upcoming visits and cancel from one simple dashboard, anytime.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const Landing = () => {
  return (
    <div>
      <section className="bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <span className="inline-block text-xs font-semibold tracking-wide text-teal-700 bg-teal-100 rounded-full px-3 py-1 mb-6">
            Online appointment booking
          </span>
          <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
            Book appointments with our doctors in minutes. Patients, doctors, and staff
            all manage their care from one simple, secure platform.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700 transition-colors"
            >
              Book an appointment
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto rounded-md border border-gray-300 text-gray-700 px-6 py-3 font-medium hover:border-gray-400 transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center sm:text-left">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-teal-100 text-teal-700 mb-4">
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
          © {new Date().getFullYear()} Patient Appointments
        </div>
      </footer>
    </div>
  );
};

export default Landing;
