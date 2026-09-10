import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  GridIcon,
  CalendarPlusIcon,
  ClockIcon,
  UsersIcon,
  LogoutIcon,
  StethoscopeIcon,
  XIcon,
} from "./icons";

const NAV_ITEMS = {
  patient: [
    { to: "/dashboard", label: "Dashboard", icon: GridIcon },
    { to: "/doctors", label: "Find a Doctor", icon: StethoscopeIcon },
    { to: "/book", label: "Book Appointment", icon: CalendarPlusIcon },
  ],
  doctor: [
    { to: "/dashboard", label: "Dashboard", icon: GridIcon },
    { to: "/availability", label: "Manage Availability", icon: ClockIcon },
  ],
  admin: [
    { to: "/dashboard", label: "Dashboard", icon: GridIcon },
    { to: "/admin/users", label: "Manage Users", icon: UsersIcon },
  ],
};

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return null;

  const items = NAV_ITEMS[user.role] || [];

  return (
    // Uses the transform property (not Tailwind's translate-x-* utilities, which emit the
    // newer standalone `translate` CSS property) for the off-canvas slide, for the widest
    // possible browser compatibility on this dynamically-toggled, fixed-position element.
    <aside
      className={`w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:[transform:translateX(0)] ${
        isOpen ? "[transform:translateX(0)]" : "[transform:translateX(-100%)]"
      }`}
    >
      <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <img src="/logo.jpg" alt="My Health School" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-base font-semibold text-gray-900">My Health School</span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          aria-label="Close menu"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-teal-600" : "text-gray-400"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <div className="px-3 mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <LogoutIcon className="w-5 h-5 text-gray-400" />
          Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
