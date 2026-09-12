import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
      <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 min-w-0">
        <Logo />
      </Link>
      {user ? (
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
      ) : (
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 whitespace-nowrap">
            Doctor Login
          </Link>
          <Link
            to="/book"
            className="text-sm px-3 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 font-medium whitespace-nowrap"
          >
            Book Appointment
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
