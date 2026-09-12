import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
import { MailIcon } from "../components/icons";

const inputClass =
  "w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setResult(res.data);
    } catch {
      setResult({ message: "Something went wrong, please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Forgot your password?" subtitle="We'll help you get back into your account.">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-8">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5">
          <MailIcon className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Reset password</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your account email and we'll send you a reset link.</p>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-3">{result.message}</p>
            {result.demoResetLink && (
              <div className="text-sm bg-amber-50 border border-amber-100 rounded-md p-3">
                <p className="text-amber-800 font-medium mb-1">Demo mode — no email provider is configured</p>
                <p className="text-amber-700 text-xs mb-2">
                  In production this link would only ever be emailed to you. Here it is directly so you can
                  actually test the flow:
                </p>
                <Link to={result.demoResetLink.replace(/^.*\/reset-password/, "/reset-password")} className="text-teal-700 font-medium hover:underline break-all">
                  {result.demoResetLink}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm shadow-teal-600/30"
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
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

export default ForgotPassword;
