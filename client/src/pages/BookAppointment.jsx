import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import DemoPaymentForm from "../components/DemoPaymentForm";
import {
  StethoscopeIcon,
  ClockIcon,
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  TicketIcon,
  CheckCircleIcon,
  VideoIcon,
  ChevronLeftIcon,
} from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600";

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
const formatDateChip = (dateKey) => new Date(dateKey).toLocaleDateString([], { weekday: "short", day: "numeric" });

const BookAppointment = () => {
  const [searchParams] = useSearchParams();
  const preselectedDoctorId = searchParams.get("doctorId") || "";

  const [patientForm, setPatientForm] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
    email: "",
    city: "",
  });
  const [touched, setTouched] = useState({});

  const [doctors, setDoctors] = useState([]);
  const [specialization, setSpecialization] = useState("");
  const [doctorId, setDoctorId] = useState(preselectedDoctorId);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [allSlots, setAllSlots] = useState([]);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [appointmentType, setAppointmentType] = useState("in-person");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

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
        setAppointmentType(docRes.data.consultationType === "video" ? "video" : "in-person");
      })
      .finally(() => setLoadingDoctor(false));
  }, [doctorId]);

  const specializations = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return [...set].sort();
  }, [doctors]);

  const filteredDoctors = useMemo(
    () => (specialization ? doctors.filter((d) => d.specialization === specialization) : doctors),
    [doctors, specialization]
  );

  const availableDateKeys = useMemo(() => {
    const keys = [...new Set(allSlots.map((s) => toDateKey(s.startTime)))].sort();
    return keys.slice(0, 14);
  }, [allSlots]);

  useEffect(() => {
    if (availableDateKeys.length && !availableDateKeys.includes(selectedDate)) {
      setSelectedDate(availableDateKeys[0]);
      setSlotId("");
    } else if (!availableDateKeys.length) {
      setSelectedDate("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDateKeys]);

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

  const handlePatientFormChange = (e) => setPatientForm({ ...patientForm, [e.target.name]: e.target.value });
  const handlePatientFieldBlur = (e) => setTouched({ ...touched, [e.target.name]: true });
  const handlePhoneChange = (e) =>
    setPatientForm({ ...patientForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) });
  const handleAgeChange = (e) =>
    setPatientForm({ ...patientForm, age: e.target.value.replace(/\D/g, "").slice(0, 3) });

  const phoneValid = patientForm.phone.length === 10;
  const ageValid = patientForm.age !== "" && Number(patientForm.age) >= 0 && Number(patientForm.age) <= 120;
  const patientDetailsValid = patientForm.name.trim() && ageValid && patientForm.gender && phoneValid;

  const handleSelectDoctor = (id) => {
    setDoctorId(id);
    setSelectedDate("");
    setSlotId("");
  };

  const handleChangeDoctor = () => {
    setDoctorId("");
    setDoctorProfile(null);
    setAllSlots([]);
    setSelectedDate("");
    setSlotId("");
  };

  // "/" and "/book" both render this same page, so there's no separate home
  // screen to link back to -- this is what "back to home" means here: wipe
  // everything and return to a blank form, whether from mid-booking or from
  // the confirmation screen.
  const resetAll = () => {
    handleChangeDoctor();
    setSpecialization("");
    setPatientForm({ name: "", age: "", gender: "", phone: "", email: "", city: "" });
    setTouched({});
    setReason("");
    setAppointmentType("in-person");
    setError("");
    setBookingResult(null);
  };

  const hasProgress = Boolean(
    doctorId ||
      patientForm.name ||
      patientForm.phone ||
      patientForm.age ||
      patientForm.gender ||
      patientForm.email ||
      patientForm.city
  );

  const canSubmit = patientDetailsValid && doctorId && slotId && !submitting;

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/appointments", {
        slotId,
        reason,
        appointmentType,
        patientInfo: {
          name: patientForm.name.trim(),
          age: Number(patientForm.age),
          gender: patientForm.gender,
          phone: patientForm.phone.trim(),
          email: patientForm.email.trim() || undefined,
          city: patientForm.city.trim() || undefined,
        },
      });
      setBookingResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (bookingResult) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Appointment request sent</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your request has been submitted. We'll contact you on your registered mobile number.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5 mb-1">
              <TicketIcon className="w-4 h-4" />
              Reference number
            </p>
            <p className="text-2xl font-semibold text-gray-900 tracking-wide">{bookingResult.referenceNumber}</p>
          </div>

          <div className="text-left space-y-1.5 text-sm text-gray-700 mb-6">
            <p className="font-medium text-gray-900">{doctorProfile?.name}</p>
            <p className="text-gray-500">{doctorProfile?.specialization || "General Practice"}</p>
            <p>{new Date(bookingResult.date).toLocaleDateString([], { dateStyle: "medium" })}</p>
            <p>{formatTime(bookingResult.date)}</p>
            <p className="text-amber-700 bg-amber-50 inline-block px-2 py-1 rounded-md text-xs font-medium mt-1">
              Status: Pending doctor confirmation
            </p>
          </div>

          {bookingResult.payment && bookingResult.payment.status !== "not_required" && (
            <div className="text-left mb-6 pt-5 border-t border-gray-100">
              <DemoPaymentForm
                payment={bookingResult.payment}
                appointmentStatus={bookingResult.status}
                appointmentType={bookingResult.appointmentType}
                referenceNumber={bookingResult.referenceNumber}
                phone={patientForm.phone.trim()}
                onPaid={(payment) => setBookingResult({ ...bookingResult, payment })}
              />
            </div>
          )}

          <p className="text-xs text-gray-400 mb-4">
            Save this reference number — you'll need it, along with your phone number, to check your appointment
            status later.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm font-medium">
            <Link to="/status" className="text-teal-700 hover:underline">
              Check appointment status
            </Link>
            <span className="text-gray-300">·</span>
            <button type="button" onClick={resetAll} className="text-teal-700 hover:underline">
              Book another appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 text-center">
        {hasProgress && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Start over
          </button>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-teal-950">
          Book a doctor's appointment <span className="text-teal-700">right here.</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-500">
          No account, no phone calls — pick a doctor, pick a time, and you're done.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10">
        <form onSubmit={handleConfirm} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-7">
          {/* doctor selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2.5">
              Select doctor <span className="text-red-500">*</span>
            </label>

            {doctorId && doctorProfile ? (
              <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4 flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <StethoscopeIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{doctorProfile.name}</p>
                      <p className="text-sm text-teal-700">{doctorProfile.specialization || "General Practice"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleChangeDoctor}
                      className="text-xs font-medium text-teal-700 hover:underline shrink-0"
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    {doctorProfile.location && (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                        {doctorProfile.location}
                      </span>
                    )}
                    {doctorProfile.experience != null && (
                      <span className="flex items-center gap-1">
                        <BriefcaseIcon className="w-3.5 h-3.5 text-gray-400" />
                        {doctorProfile.experience} yrs experience
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <VideoIcon className="w-3.5 h-3.5 text-gray-400" />
                      {CONSULTATION_LABELS[doctorProfile.consultationType] || CONSULTATION_LABELS["in-person"]}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className={`${inputClass} sm:max-w-xs mb-3`}
                >
                  <option value="">All specialities</option>
                  {specializations.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {filteredDoctors.length === 0 ? (
                  <p className="text-sm text-gray-500">No doctors in this speciality yet.</p>
                ) : (
                  <select
                    value=""
                    onChange={(e) => handleSelectDoctor(e.target.value)}
                    className={`${inputClass} sm:max-w-md`}
                  >
                    <option value="" disabled>
                      Select a doctor
                    </option>
                    {filteredDoctors.map((doctor) => (
                      <option key={doctor._id} value={doctor._id}>
                        {doctor.name} — {doctor.specialization}
                        {doctor.location ? ` (${doctor.location.split(",")[0]})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* date + time */}
          {doctorId && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2.5">
                Date &amp; time <span className="text-red-500">*</span>
              </label>
              {loadingDoctor ? (
                <p className="text-sm text-gray-500">Loading available times...</p>
              ) : availableDateKeys.length === 0 ? (
                <p className="text-sm text-gray-500">This doctor has no open slots right now.</p>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
                    {availableDateKeys.map((dateKey) => (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dateKey);
                          setSlotId("");
                        }}
                        className={`shrink-0 w-16 rounded-lg border py-2 text-center ${
                          selectedDate === dateKey
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "border-gray-300 text-gray-700 hover:border-teal-500"
                        }`}
                      >
                        <span className="block text-[11px] uppercase tracking-wide opacity-80">
                          {formatDateChip(dateKey).split(" ")[0]}
                        </span>
                        <span className="block text-base font-bold">{formatDateChip(dateKey).split(" ")[1]}</span>
                      </button>
                    ))}
                  </div>

                  {groupedDaySlots.length === 0 ? (
                    <p className="text-sm text-gray-500">No open slots that day.</p>
                  ) : (
                    <div className="space-y-3">
                      {groupedDaySlots.map((group) => (
                        <div key={group.label}>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">{group.label}</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
                </>
              )}
            </div>
          )}

          {/* patient details */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2.5">Your details</label>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium text-gray-500 mb-1">
                  Full name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="name"
                    name="name"
                    value={patientForm.name}
                    onChange={handlePatientFormChange}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-gray-500 mb-1">
                  Mobile number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <PhoneIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    name="phone"
                    value={patientForm.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePatientFieldBlur}
                    maxLength={10}
                    className={`${inputClass} pl-9`}
                  />
                </div>
                {touched.phone && patientForm.phone && !phoneValid && (
                  <p className="text-xs text-red-600 mt-1">Enter a valid 10-digit mobile number</p>
                )}
              </div>
              <div>
                <label htmlFor="age" className="block text-xs font-medium text-gray-500 mb-1">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  id="age"
                  type="text"
                  inputMode="numeric"
                  name="age"
                  value={patientForm.age}
                  onChange={handleAgeChange}
                  onBlur={handlePatientFieldBlur}
                  className={inputClass}
                />
                {touched.age && patientForm.age !== "" && !ageValid && (
                  <p className="text-xs text-red-600 mt-1">Enter an age between 0 and 120</p>
                )}
              </div>
              <div>
                <label htmlFor="gender" className="block text-xs font-medium text-gray-500 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={patientForm.gender}
                  onChange={handlePatientFormChange}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1">
                  Email (optional)
                </label>
                <div className="relative">
                  <MailIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={patientForm.email}
                    onChange={handlePatientFormChange}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="city" className="block text-xs font-medium text-gray-500 mb-1">
                  City (optional)
                </label>
                <div className="relative">
                  <MapPinIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="city"
                    name="city"
                    value={patientForm.city}
                    onChange={handlePatientFormChange}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
            </div>

            {doctorProfile?.consultationType === "both" && (
              <div className="mt-4">
                <p className="block text-xs font-medium text-gray-500 mb-1.5">Appointment type</p>
                <div className="flex gap-4">
                  {["in-person", "video"].map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="appointmentType"
                        value={type}
                        checked={appointmentType === type}
                        onChange={(e) => setAppointmentType(e.target.value)}
                      />
                      {CONSULTATION_LABELS[type]}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="reason" className="block text-xs font-medium text-gray-500 mb-1">
                Reason for visit (optional)
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Fever and headache for 2 days"
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
            <div className="text-sm text-gray-500">
              {doctorProfile?.consultationFee != null ? (
                <>
                  Consultation fee <span className="text-lg font-bold text-gray-900">₹{doctorProfile.consultationFee}</span>
                </>
              ) : (
                "Select a doctor to see the consultation fee"
              )}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-teal-600 text-white px-8 py-3 font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Booking..." : "Book Appointment"}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden mt-8">
          {[
            { num: doctors.length || "—", label: "doctors" },
            { num: specializations.length || "—", label: "specialities" },
            { num: 0, label: "accounts needed" },
            { num: "24/7", label: "booking open" },
          ].map((s) => (
            <div key={s.label} className="bg-white text-center py-4 px-2">
              <div className="text-xl font-extrabold text-teal-700">{s.num}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already booked?{" "}
          <Link to="/status" className="text-teal-700 font-medium hover:underline">
            Check your appointment status
          </Link>
          {" · "}
          <Link to="/doctors" className="text-teal-700 font-medium hover:underline">
            Browse all doctors
          </Link>
        </p>
      </div>
    </div>
  );
};

export default BookAppointment;
