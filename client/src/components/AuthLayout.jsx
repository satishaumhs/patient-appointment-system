import { CheckIcon } from "./icons";

const HIGHLIGHTS = [
  "Patients book without creating an account",
  "Manage your availability in real time",
  "Accept, reject, or reschedule requests",
];

const AuthLayout = ({ title, subtitle, children }) => (
  <div className="min-h-[calc(100vh-73px)] flex">
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-violet-950 text-white flex-col justify-center px-14">
      <div className="absolute -top-24 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-28 -left-16 w-72 h-72 rounded-full bg-violet-400/20 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <h2 className="text-3xl font-bold leading-tight mb-4">{title}</h2>
        <p className="text-teal-50/90 text-base mb-8 max-w-sm">{subtitle}</p>
        <ul className="space-y-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-teal-50">
              <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <CheckIcon className="w-3 h-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>

    <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-10 lg:py-16 bg-stone-50">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  </div>
);

export default AuthLayout;
