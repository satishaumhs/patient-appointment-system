import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
      <Link to="/" className="text-lg font-semibold text-gray-900">
        Patient Appointments
      </Link>
      {user && (
        <div className="flex items-center gap-4">
          {user.role === "doctor" && (
            <Link to="/availability" className="text-sm text-gray-600 hover:text-gray-900 underline">
              Manage availability
            </Link>
          )}
          <span className="text-sm text-gray-600">
            {user.name} <span className="text-gray-400">({user.role})</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700"
          >
            Log out
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
