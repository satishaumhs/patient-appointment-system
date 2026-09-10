import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import MonthCalendar from "../components/MonthCalendar";
import {
  StethoscopeIcon,
  ClockIcon,
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  GraduationCapIcon,
} from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

const CONSULTATION_LABELS = {
  "in-person": "In-person",
  video: "Video consultation",
  both: "In-person & video",
};

const toDateKey = (d) => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const STEPS = [
  { id: 1, label: "Choose doctor" },
  { id: 2, label: "Select date & time" },
  { id: 3, label: "Confirm" },
];

const BookAppointment = () => {
  const [searchParams] = useSearchParams();
  const preselectedDoctorId = searchParams.get("doctorId") || "";

  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [doctorId, setDoctorId] = useState(preselectedDoctorId);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [allSlots, setAllSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState(preselectedDoctorId ? 2 : 1);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/users/doctors").then((res) => setDoctors(res.data));
  }, []);

  useEffect(() => {
    if (!doctorId) {
      setDoctorProfile(null);
      setAllSlots([]);
      return;
    }
    setLoadingDoctor(true);
    Promise.all([api.get(`/users/doctors/${doctorId}`), api.get(`/availability/${doctorId}`)])
      .then(([docRes, slotsRes]) => {
        setDoctorProfile(docRes.data);
        setAllSlots(slotsRes.data);
      })
      .finally(() => setLoadingDoctor(false));
  }, [doctorId]);

  const specializations = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return [...set].sort();
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return doctors.filter((d) => {
      const matchesSearch =
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.location || "").toLowerCase().includes(term) ||
        (d.specialization || "").toLowerCase().includes(term);
      const matchesSpecialization = !specialization || d.specialization === specialization;
      return matchesSearch && matchesSpecialization;
    });
  }, [doctors, search, specialization]);

  const availableDates = useMemo(() => new Set(allSlots.map((s) => toDateKey(s.startTime))), [allSlots]);

  const daySlots = useMemo(
    () => (selectedDate ? allSlots.filter((s) => toDateKey(s.startTime) === selectedDate) : []),
    [allSlots, selectedDate]
  );

  const groupedDaySlots = useMemo(() => {
    const groups = [
      { label: "Morning", items: [] },
      { label: "Afternoon", items: [] },
      { label: "Evening", items: [] },
    ];
    daySlots.forEach((slot) => {
      const hour = new Date(slot.startTime).getHours();
      if (hour < 12) groups[0].items.push(slot);
      else if (hour < 17) groups[1].items.push(slot);
      else groups[2].items.push(slot);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [daySlots]);

  const selectedSlot = allSlots.find((s) => s._id === slotId);

  const handleSelectDoctor = (id) => {
    setDoctorId(id);
    setSelectedDate("");
    setSlotId("");
    setStep(2);
  };

  const handleChangeDoctor = () => {
    setDoctorId("");
    setSelectedDate("");
    setSlotId("");
    setStep(1);
  };

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey);
    setSlotId("");
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/appointments", { slotId, reason });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Book an appointment</h1>
      <p className="text-sm text-gray-500 mb-6">Select a doctor, choose a date and time slot, and confirm.</p>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  step >= s.id ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.id}
              </span>
              <span
                className={`text-sm font-medium whitespace-nowrap ${
                  step >= s.id ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="w-8 h-px bg-gray-200 shrink-0" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input
              type="text"
              placeholder="Search by name, specialty, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} sm:max-w-sm`}
            />
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className={`${inputClass} sm:max-w-xs`}
            >
              <option value="">All specializations</option>
              {specializations.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {filteredDoctors.length === 0 ? (
            <p className="text-sm text-gray-500">No doctors match your search.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.map((doctor) => (
                <button
                  key={doctor._id}
                  type="button"
                  onClick={() => handleSelectDoctor(doctor._id)}
                  className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-500 hover:shadow-md transition-all flex flex-col"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <StethoscopeIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{doctor.name}</h3>
                      <p className="text-sm text-teal-700">{doctor.specialization || "General Practice"}</p>
                    </div>
                  </div>

                  {doctor.location && (
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{doctor.location}</span>
                    </p>
                  )}
                  {doctor.experience != null && (
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                      <BriefcaseIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {doctor.experience} years experience
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mb-3">
                    {CONSULTATION_LABELS[doctor.consultationType] || CONSULTATION_LABELS["in-person"]}
                  </p>

                  {doctor.consultationFee != null && (
                    <p className="mt-auto pt-3 border-t border-gray-100 text-sm font-semibold text-gray-900">
                      ₹{doctor.consultationFee}
                      <span className="font-normal text-gray-400"> consultation fee</span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step >= 2 && doctorId && loadingDoctor && <p className="text-sm text-gray-500">Loading doctor...</p>}

      {step >= 2 && doctorId && doctorProfile && (
        <div className="grid lg:grid-cols-[300px_1fr] gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit">
            <div className="flex items-start justify-between mb-3">
              <div className="w-14 h-14 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <StethoscopeIcon className="w-7 h-7" />
              </div>
              <button
                type="button"
                onClick={handleChangeDoctor}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Change
              </button>
            </div>
            <h2 className="font-semibold text-gray-900">{doctorProfile.name}</h2>
            <p className="text-sm text-teal-700 mb-3">{doctorProfile.specialization || "General Practice"}</p>
            <div className="space-y-1.5 text-xs text-gray-500">
              {doctorProfile.qualification && (
                <p className="flex items-center gap-1.5">
                  <GraduationCapIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {doctorProfile.qualification}
                </p>
              )}
              {doctorProfile.experience != null && (
                <p className="flex items-center gap-1.5">
                  <BriefcaseIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {doctorProfile.experience} years experience
                </p>
              )}
              {doctorProfile.location && (
                <p className="flex items-center gap-1.5">
                  <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {doctorProfile.location}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <ClockIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {CONSULTATION_LABELS[doctorProfile.consultationType] || CONSULTATION_LABELS["in-person"]}
              </p>
            </div>
            {doctorProfile.bio && (
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 leading-relaxed">
                {doctorProfile.bio}
              </p>
            )}
            {doctorProfile.consultationFee != null && (
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400">Consultation fee</p>
                <p className="text-base font-semibold text-gray-900">₹{doctorProfile.consultationFee}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {step === 2 && (
              <div className="grid sm:grid-cols-2 gap-6">
                <MonthCalendar
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  availableDates={availableDates}
                />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString([], {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })
                      : "Pick a date"}
                  </h3>
                  {!selectedDate ? (
                    <p className="text-sm text-gray-500">Choose a date on the calendar to see open times.</p>
                  ) : groupedDaySlots.length === 0 ? (
                    <p className="text-sm text-gray-500">No open slots that day. Try another date.</p>
                  ) : (
                    <div className="space-y-4">
                      {groupedDaySlots.map((group) => (
                        <div key={group.label}>
                          <p className="text-xs font-medium text-gray-500 mb-2">{group.label}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {group.items.map((slot) => (
                              <button
                                key={slot._id}
                                type="button"
                                onClick={() => setSlotId(slot._id)}
                                className={`text-sm px-2 py-2 rounded-md border ${
                                  slotId === slot._id
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "border-gray-300 text-gray-700 hover:border-teal-600"
                                }`}
                              >
                                {formatTime(slot.startTime)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!slotId}
                    onClick={() => setStep(3)}
                    className="w-full mt-6 rounded-md bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next: Confirm appointment
                  </button>
                </div>
              </div>
            )}

            {step === 3 && selectedSlot && (
              <form onSubmit={handleConfirm} className="max-w-md">
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-1.5 text-sm">
                  <p className="font-medium text-gray-900">{doctorProfile.name}</p>
                  <p className="text-gray-500">{doctorProfile.specialization || "General Practice"}</p>
                  <p className="text-gray-700 pt-1.5 flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    {new Date(selectedSlot.startTime).toLocaleDateString([], { dateStyle: "medium" })}
                  </p>
                  <p className="text-gray-700 flex items-center gap-1.5">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
                  </p>
                </div>

                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for visit
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  className={`${inputClass} mb-4`}
                />

                {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-md border border-gray-300 text-gray-700 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-md bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-50"
                  >
                    {submitting ? "Booking..." : "Confirm appointment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookAppointment;
