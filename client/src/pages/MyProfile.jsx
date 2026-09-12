import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { ChevronLeftIcon, EditIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const toForm = (d) => ({
  name: d.name || "",
  specialization: d.specialization || "",
  location: d.location || "",
  consultationType: d.consultationType || "in-person",
  bio: d.bio || "",
  experience: d.experience ?? "",
  qualification: d.qualification || "",
  consultationFee: d.consultationFee ?? "",
});

const Field = ({ label, value, className = "" }) => (
  <div className={className}>
    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
    <p className="text-sm text-gray-900 whitespace-pre-wrap">
      {value || value === 0 ? value : <span className="text-gray-400">Not set</span>}
    </p>
  </div>
);

const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/users/doctors/${user.id}`).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, [user.id]);

  const startEditing = () => {
    setSaved(false);
    setError("");
    setForm(toForm(data));
    setEditing(true);
  };

  const cancelEditing = () => {
    setError("");
    setEditing(false);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await api.patch("/users/me", {
        ...form,
        // An explicit blank means "clear this field" -- send null, not
        // undefined, so it actually reaches the update (a key with an
        // undefined value is dropped by JSON.stringify and would silently
        // leave the old value in place).
        experience: form.experience === "" ? null : Number(form.experience),
        consultationFee: form.consultationFee === "" ? null : Number(form.consultationFee),
      });
      setData(res.data);
      updateUser({ name: res.data.name });
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">My profile</h1>
          <p className="text-sm text-gray-500">
            Shown on your public profile — this is what patients see before they book.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <EditIcon className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {saved && <p className="text-sm text-green-700 mb-4">Profile updated.</p>}
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Name" value={data.name} />
            <Field label="Specialization" value={data.specialization} />
            <Field label="Location" value={data.location} />
            <Field label="Consultation type" value={CONSULTATION_LABELS[data.consultationType] || CONSULTATION_LABELS["in-person"]} />
            <Field label="Experience" value={data.experience != null ? `${data.experience} years` : ""} />
            <Field label="Consultation fee" value={data.consultationFee != null ? `₹${data.consultationFee}` : ""} />
            <Field label="Qualification" value={data.qualification} className="sm:col-span-2" />
            <Field label="Bio" value={data.bio} className="sm:col-span-2" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input id="name" name="name" value={form.name} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
                Specialization
              </label>
              <input
                id="specialization"
                name="specialization"
                value={form.specialization}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input id="location" name="location" value={form.location} onChange={handleChange} className={inputClass} />
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
            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
                Experience (years)
              </label>
              <input
                id="experience"
                name="experience"
                type="number"
                min="0"
                max="80"
                value={form.experience}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="consultationFee" className="block text-sm font-medium text-gray-700 mb-1">
                Consultation fee (₹)
              </label>
              <input
                id="consultationFee"
                name="consultationFee"
                type="number"
                min="0"
                value={form.consultationFee}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="qualification" className="block text-sm font-medium text-gray-700 mb-1">
                Qualification
              </label>
              <input
                id="qualification"
                name="qualification"
                value={form.qualification}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea id="bio" name="bio" value={form.bio} onChange={handleChange} rows={4} className={inputClass} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-teal-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-md border border-gray-300 text-gray-700 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MyProfile;
