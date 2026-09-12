import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
import { LockIcon, CheckCircleIcon } from "../components/icons";

const inputClass =
  "w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Could not reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Set a new password." subtitle="Choose something you'll remember this time.">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-8">
        {done ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-5">
              <CheckCircleIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Password reset</h1>
            <p className="text-sm text-gray-500 mb-6">You can now log in with your new password.</p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-lg bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/30"
            >
              Go to log in
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5">
              <LockIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">New password</h1>
            <p className="text-sm text-gray-500 mb-6">Enter a new password for your account.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm password
                </label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
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
                {submitting ? "Resetting..." : "Reset password"}
              </button>
            </form>
          </>
        )}
        <p className="text-sm text-gray-600 mt-5">
          <Link to="/login" className="text-teal-700 font-medium hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
