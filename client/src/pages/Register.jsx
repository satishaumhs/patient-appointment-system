import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { MailIcon, LockIcon, UserIcon } from "../components/icons";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors";
const iconInputClass =
  "w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors";

const Register = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "patient",
    specialization: "",
    location: "",
    consultationType: "in-person",
    experience: "",
    qualification: "",
    consultationFee: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          "Registration failed"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Join us today."
      subtitle="Create an account to book appointments, manage your schedule, and stay connected with your care team."
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-8">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5">
          <UserIcon className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create an account</h1>
        <p className="text-sm text-gray-500 mb-6">Get started with My Health School in a minute.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className={iconInputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <MailIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className={iconInputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <LockIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                className={iconInputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
            <select id="role" name="role" value={form.role} onChange={handleChange} className={inputClass}>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>

          {form.role === "doctor" && (
            <>
              <div>
                <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
                  Specialization
                </label>
                <input
                  id="specialization"
                  name="specialization"
                  value={form.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Cardiologist, General Physician"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Downtown Clinic, New York, NY"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="consultationType" className="block text-sm font-medium text-gray-700 mb-1">
                  Consultation type
                </label>
                <select
                  id="consultationType"
                  name="consultationType"
                  value={form.consultationType}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="in-person">In-person</option>
                  <option value="video">Video</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
                    Years of experience
                  </label>
                  <input
                    id="experience"
                    type="number"
                    min="0"
                    name="experience"
                    value={form.experience}
                    onChange={handleChange}
                    placeholder="e.g. 8"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="consultationFee" className="block text-sm font-medium text-gray-700 mb-1">
                    Consultation fee
                  </label>
                  <input
                    id="consultationFee"
                    type="number"
                    min="0"
                    name="consultationFee"
                    value={form.consultationFee}
                    onChange={handleChange}
                    placeholder="e.g. 500"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="qualification" className="block text-sm font-medium text-gray-700 mb-1">
                  Qualification
                </label>
                <input
                  id="qualification"
                  name="qualification"
                  value={form.qualification}
                  onChange={handleChange}
                  placeholder="e.g. MBBS, MD (General Medicine)"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm shadow-teal-600/30"
          >
            {submitting ? "Creating account..." : "Register"}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-teal-700 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;
