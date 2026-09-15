import { Link } from "react-router-dom";
import { TicketIcon, StethoscopeIcon } from "../components/icons";

const ContactUs = () => (
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
    <h1 className="text-2xl sm:text-3xl font-extrabold text-teal-950 mb-2">Contact Us</h1>
    <p className="text-gray-600 mb-10">
      My Health School doesn't have a support line — most things you'd need are handled directly in the app.
    </p>

    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
          <TicketIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">Question about a booking?</h2>
          <p className="text-sm text-gray-600 mb-2">
            Look it up with your reference number and phone number to see its status, reschedule details, or pay
            online.
          </p>
          <Link to="/status" className="text-sm font-medium text-teal-700 hover:underline">
            Check appointment status →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
          <StethoscopeIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">A doctor with an account question?</h2>
          <p className="text-sm text-gray-600 mb-2">
            Sign in to manage your availability, appointments, and profile.
          </p>
          <Link to="/login" className="text-sm font-medium text-teal-700 hover:underline">
            Doctor login →
          </Link>
        </div>
      </div>
    </div>
  </div>
);

export default ContactUs;
