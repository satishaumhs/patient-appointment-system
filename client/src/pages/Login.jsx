import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { MailIcon, LockIcon } from "../components/icons";

const inputClass =
  "w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem("mhs_session_expired")) {
      sessionStorage.removeItem("mhs_session_expired");
      setSessionExpired(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Log in to manage your availability and appointment requests."
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-8">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5">
          <LockIcon className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Log in</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your details to access your account.</p>
        {sessionExpired && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-4">
            Your session expired. Please log in again.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <MailIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-teal-700 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <LockIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm shadow-teal-600/30"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-5">
          No account?{" "}
          <Link to="/register" className="text-teal-700 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
