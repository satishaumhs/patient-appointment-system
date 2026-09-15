import { Link } from "react-router-dom";
import { TicketIcon, ClockIcon, VideoIcon, BellIcon, ScaleIcon, CreditCardIcon } from "../components/icons";

const SERVICES = [
  {
    icon: TicketIcon,
    title: "Anonymous booking",
    body: "Book with just your name, age, and phone number. No account, no password — your reference number is your record.",
    link: { to: "/book", label: "Book now" },
  },
  {
    icon: ClockIcon,
    title: "Real-time availability",
    body: "See a doctor's actual open slots and reserve one directly, instead of requesting a time and waiting to hear back.",
  },
  {
    icon: VideoIcon,
    title: "In-person or video visits",
    body: "Doctors set whether they see patients in person, over video, or both — pick whichever fits when you book.",
  },
  {
    icon: BellIcon,
    title: "Waitlist for fully booked doctors",
    body: "If a doctor has no open slots, join their waitlist and check back once new availability opens up.",
  },
  {
    icon: ScaleIcon,
    title: "Compare doctors side by side",
    body: "Shortlist a few doctors from the same specialty and compare experience, fees, and ratings before you choose.",
    link: { to: "/doctors", label: "Find a doctor" },
  },
  {
    icon: CreditCardIcon,
    title: "Status tracking & online payment",
    body: "Look up any booking with your reference number and phone, and pay online once your doctor confirms.",
    link: { to: "/status", label: "Check status" },
  },
];

const Services = () => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
    <h1 className="text-2xl sm:text-3xl font-extrabold text-teal-950 mb-2">Services</h1>
    <p className="text-gray-600 mb-10">Everything you need to find a doctor and get seen, in one place.</p>

    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {SERVICES.map(({ icon: Icon, title, body, link }) => (
        <div key={title} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-1.5">{title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{body}</p>
          {link && (
            <Link to={link.to} className="mt-auto text-sm font-medium text-teal-700 hover:underline">
              {link.label} →
            </Link>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default Services;
