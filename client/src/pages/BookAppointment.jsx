import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import MonthCalendar from "../components/MonthCalendar";
import DemoPaymentForm from "../components/DemoPaymentForm";
import {
  StethoscopeIcon,
  ClockIcon,
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  TicketIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
} from "../components/icons";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";
const iconInputClass =
  "w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600";

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
  { id: 1, label: "Your details" },
  { id: 2, label: "Choose doctor" },
  { id: 3, label: "Date & time" },
  { id: 4, label: "Confirm" },
];

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

  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [doctorId, setDoctorId] = useState(preselectedDoctorId);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [allSlots, setAllSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [appointmentType, setAppointmentType] = useState("in-person");
  const [step, setStep] = useState(1);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [touched, setTouched] = useState({});

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

  const handlePatientFormChange = (e) => setPatientForm({ ...patientForm, [e.target.name]: e.target.value });
  const handlePatientFieldBlur = (e) => setTouched({ ...touched, [e.target.name]: true });
  const handlePhoneChange = (e) =>
    setPatientForm({ ...patientForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) });
  const handleAgeChange = (e) =>
    setPatientForm({ ...patientForm, age: e.target.value.replace(/\D/g, "").slice(0, 3) });

  const phoneDigits = patientForm.phone;
  const phoneValid = phoneDigits.length === 10;
  const ageValid = patientForm.age !== "" && Number(patientForm.age) >= 0 && Number(patientForm.age) <= 120;

  const patientDetailsValid =
    patientForm.name.trim() && ageValid && patientForm.gender && phoneValid;

  const handleContinueFromDetails = () => {
    setStep(preselectedDoctorId ? 3 : 2);
  };

  const handleSelectDoctor = (id) => {
    setDoctorId(id);
    setSelectedDate("");
    setSlotId("");
    setStep(3);
  };

  const handleChangeDoctor = () => {
    setDoctorId("");
    setSelectedDate("");
    setSlotId("");
    setStep(2);
  };

  const handleBackToDoctorPicker = () => setStep(1);
  const handleBackFromDateTime = () => setStep(preselectedDoctorId ? 1 : 2);

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey);
    setSlotId("");
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
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
      <div className="max-w-md mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to home
        </Link>
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
          <Link to="/status" className="text-sm font-medium text-teal-700 hover:underline">
            Check appointment status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to home
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Book an appointment</h1>
      <p className="text-sm text-gray-500 mb-6">No account needed — tell us about yourself, pick a doctor and time, and confirm.</p>

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
        <div className="max-w-md bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Tell us a little about yourself</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="name"
                  name="name"
                  value={patientForm.name}
                  onChange={handlePatientFormChange}
                  required
                  className={iconInputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  id="age"
                  type="text"
                  inputMode="numeric"
                  name="age"
                  value={patientForm.age}
                  onChange={handleAgeChange}
                  onBlur={handlePatientFieldBlur}
                  required
                  className={inputClass}
                />
                {touched.age && patientForm.age !== "" && !ageValid && (
                  <p className="text-xs text-red-600 mt-1">Enter an age between 0 and 120</p>
                )}
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={patientForm.gender}
                  onChange={handlePatientFormChange}
                  required
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
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Mobile number
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
                  required
                  className={iconInputClass}
                />
              </div>
              {touched.phone && patientForm.phone && !phoneValid && (
                <p className="text-xs text-red-600 mt-1">Enter a valid 10-digit mobile number</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
                  className={iconInputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                City (optional)
              </label>
              <div className="relative">
                <MapPinIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="city"
                  name="city"
                  value={patientForm.city}
                  onChange={handlePatientFormChange}
                  className={iconInputClass}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!patientDetailsValid}
              onClick={handleContinueFromDetails}
              className="w-full rounded-md bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <button
            type="button"
            onClick={handleBackToDoctorPicker}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-700 mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back
          </button>
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

      {step >= 3 && doctorId && loadingDoctor && <p className="text-sm text-gray-500">Loading doctor...</p>}

      {step >= 3 && doctorId && doctorProfile && (
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
            {step === 3 && (
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

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleBackFromDateTime}
                      className="rounded-md border border-gray-300 text-gray-700 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!slotId}
                      onClick={() => setStep(4)}
                      className="flex-1 rounded-md bg-teal-600 text-white py-2.5 font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next: Confirm appointment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && selectedSlot && (
              <form onSubmit={handleConfirm} className="max-w-md">
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-1.5 text-sm">
                  <p className="font-medium text-gray-900">{patientForm.name}</p>
                  <p className="text-gray-500">
                    {patientForm.age} years • {patientForm.gender}
                  </p>
                  <p className="font-medium text-gray-900 pt-1.5">{doctorProfile.name}</p>
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

                {doctorProfile.consultationType === "both" && (
                  <div className="mb-4">
                    <p className="block text-sm font-medium text-gray-700 mb-1.5">Appointment type</p>
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

                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for visit (optional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Fever and headache for 2 days"
                  className={`${inputClass} mb-4`}
                />

                {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
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
