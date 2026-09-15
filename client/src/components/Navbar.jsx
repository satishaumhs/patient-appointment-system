import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import { CreditCardIcon, CalendarPlusIcon, VideoIcon, HomeIcon, ChevronDownIcon } from "./icons";

// Matches server/scripts/seed.js's real specialties -- a static list here
// (rather than fetching /users/doctors again just for this menu) trades a
// little staleness risk for not re-querying the doctor list on every public
// page load purely to populate a nav dropdown.
const SPECIALTIES = [
  "Allergist/Immunologist",
  "Cardiologist",
  "Dentist",
  "Dermatologist",
  "ENT Specialist",
  "Endocrinologist",
  "Gastroenterologist",
  "General Physician",
  "General Surgeon",
  "Gynecologist",
  "Nephrologist",
  "Neurologist",
  "Oncologist",
  "Ophthalmologist",
  "Orthopedist",
  "Pediatrician",
  "Psychiatrist",
  "Pulmonologist",
  "Rheumatologist",
  "Urologist",
];

const UTILITY_LINKS = [
  { label: "Online Payment", to: "/status", icon: CreditCardIcon },
  { label: "Book Appointment", to: "/book", icon: CalendarPlusIcon },
  { label: "Video Consultation", to: "/doctors?type=video", icon: VideoIcon },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-1.5 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 ${
    isActive ? "text-white" : "text-teal-100/80 hover:text-white"
  }`;

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (user) {
    // A doctor/admin can still land on a public page (e.g. /doctors) while
    // signed in -- keep this minimal, their real nav lives in the app shell.
    return (
      <nav className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <Logo textClassName="text-lg font-semibold text-gray-900" />
        </Link>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-[160px]">
            {user.name} <span className="text-gray-400">({user.role})</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 shrink-0"
          >
            Log out
          </button>
        </div>
      </nav>
    );
  }

  return (
    <header>
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-gray-100 bg-white">
        {/* Plain anchor, not <Link> -- "/" and "/book" render the same
            BookAppointment page, so a SPA nav to "/" while already on it is
            a same-URL no-op that leaves any filled-in state sitting there. */}
        <a href="/" className="flex items-center gap-2 min-w-0 shrink-0">
          <Logo imgClassName="w-9 h-9" textClassName="text-base font-semibold text-gray-900 hidden sm:inline" />
        </a>
        <div className="flex items-center gap-5 sm:gap-8 overflow-x-auto">
          {UTILITY_LINKS.map(({ label, to, icon: Icon }) => (
            <Link key={label} to={to} className="flex flex-col items-center gap-1 text-teal-700 hover:text-teal-800 shrink-0">
              <Icon className="w-5 h-5" />
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-center leading-tight whitespace-nowrap">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <nav className="bg-teal-950">
        <div className="flex items-center gap-6 px-4 sm:px-6 overflow-x-auto">
          <NavLink to="/" end className={navLinkClass}>
            <HomeIcon className="w-4 h-4" />
            Home
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About Us
          </NavLink>
          <NavLink to="/doctors" end className={navLinkClass}>
            Doctors
          </NavLink>

          <details className="group relative shrink-0">
            <summary className="flex items-center gap-1 py-2.5 text-sm font-medium text-teal-100/80 hover:text-white whitespace-nowrap cursor-pointer list-none">
              Specialties
              <ChevronDownIcon className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-20 mt-0 w-64 max-h-80 overflow-y-auto bg-white rounded-b-md border border-gray-200 shadow-lg py-1.5">
              {SPECIALTIES.map((s) => (
                <Link
                  key={s}
                  to={`/doctors?specialization=${encodeURIComponent(s)}`}
                  className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700"
                >
                  {s}
                </Link>
              ))}
            </div>
          </details>

          <NavLink to="/services" className={navLinkClass}>
            Services
          </NavLink>
          <NavLink to="/contact" className={navLinkClass}>
            Contact Us
          </NavLink>

          <Link
            to="/login"
            className="ml-auto py-2.5 text-sm font-medium text-teal-100/80 hover:text-white whitespace-nowrap shrink-0"
          >
            Doctor Login
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
