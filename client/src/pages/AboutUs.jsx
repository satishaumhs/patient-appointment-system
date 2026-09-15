import { Link } from "react-router-dom";
import { UsersIcon, ClockIcon, TicketIcon } from "../components/icons";

const POINTS = [
  {
    icon: UsersIcon,
    title: "Independent doctors, one place to find them",
    body: "Every doctor on My Health School runs their own practice. We don't employ them or set their fees — we just make it easy to find the right one and get on their calendar.",
  },
  {
    icon: ClockIcon,
    title: "Real-time availability",
    body: "The time slots you see are the doctor's actual open slots, kept up to date as other patients book, reschedule, or cancel — not a guess at typical hours.",
  },
  {
    icon: TicketIcon,
    title: "No account required",
    body: "Booking doesn't require creating a login. You get a reference number tied to your phone number, which is all you need to check on or manage your visit later.",
  },
];

const AboutUs = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <h1 className="text-2xl sm:text-3xl font-extrabold text-teal-950 mb-3">About My Health School</h1>
    <p className="text-gray-600 mb-10">
      My Health School is a booking platform that connects patients with doctors across a range of specialties —
      built around one idea: reserving a doctor's time shouldn't take a phone call or an account.
    </p>

    <div className="space-y-8 mb-10">
      {POINTS.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex gap-4">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 text-center">
      <p className="text-sm text-gray-700 mb-4">Ready to see it for yourself?</p>
      <Link
        to="/book"
        className="inline-block rounded-md bg-teal-600 text-white px-6 py-2.5 font-medium hover:bg-teal-700"
      >
        Book an appointment
      </Link>
    </div>
  </div>
);

export default AboutUs;
